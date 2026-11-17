import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GraphMemoryStore } from '../src/graph-store.js';
import { ingestRepo } from '../src/ingest.js';
import { traceSymbol, traceFile } from '../src/trace.js';
import { checkMemoryText } from '../src/hygiene.js';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'demo', 'fixture-repo');

function ingestedStore() {
  const store = new GraphMemoryStore(':memory:');
  const { memories, structure } = ingestRepo(FIXTURE);
  const stored = [];
  for (const m of memories) {
    if (!checkMemoryText(m.text).ok) continue;
    stored.push(store.add(m));
  }
  const byFile = new Map();
  for (const m of stored) {
    const f = m.source?.file;
    if (!f) continue;
    if (!byFile.has(f)) byFile.set(f, []);
    byFile.get(f).push(m.id);
  }
  for (const ids of byFile.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) store.linkRelated(ids[i], ids[j]);
    }
  }
  store.addStructure(structure);
  return store;
}

test('trace: checkout test -> symbol -> file -> gotcha + rule', () => {
  const store = ingestedStore();
  const t = traceSymbol(store, 'checkout');
  assert.equal(t.symbol, 'checkout');
  assert.equal(t.definedIn, 'shop.js');
  assert.ok(t.testedBy.includes('tests/checkout.test.js'), 'test file found via TESTS edge');
  // Hop 1: the gotcha about floats + the NEVER-mutate rule (both ABOUT shop.js),
  // plus the export fact that MENTIONS checkout.
  assert.ok(t.memories.some((m) => m.hop === 1 && /floats/.test(m.text)), 'gotcha reached in 1 hop');
  assert.ok(t.memories.some((m) => m.hop === 1 && /mutate a paid order/.test(m.text)), 'rule reached in 1 hop');
  assert.ok(t.memories.some((m) => /exports checkout/.test(m.text)), 'export fact reached');
  assert.ok(t.path.length >= 4, 'path narrates every hop');
  assert.ok(t.path[0].includes('TESTS'), 'path starts at the test');
});

test('trace: unknown symbol reports nothing stored, honestly', () => {
  const store = ingestedStore();
  const t = traceSymbol(store, 'deployToKubernetes');
  assert.equal(t.definedIn, null);
  assert.equal(t.memories.length, 0);
  assert.equal(t.testedBy.length, 0);
});

test('trace: traceFile lists the file memories and its symbols', () => {
  const store = ingestedStore();
  const t = traceFile(store, 'shop.js');
  assert.deepEqual(t.symbols.sort(), ['checkout', 'legacyCartTotal']);
  assert.ok(t.memories.some((m) => /floats/.test(m.text)));
  assert.equal(t.symbolTraces.length, 2);
});
