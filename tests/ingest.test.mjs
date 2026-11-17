import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestDirectory, extractStructure, ingestRepo } from '../src/ingest.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'demo', 'fixture-repo');

test('ingest: extracts decisions, conventions, gotchas, todos, symbols', () => {
  const found = ingestDirectory(FIXTURE);
  const byType = (t) => found.filter((m) => m.type === t);
  assert.ok(byType('decision').some((m) => /JWT/.test(m.text)));
  assert.ok(byType('convention').some((m) => /mutate a paid order/.test(m.text)));
  assert.ok(byType('gotcha').some((m) => /floats/.test(m.text)));
  assert.ok(byType('todo').some((m) => /retry the payment gateway/.test(m.text)));
  assert.ok(byType('fact').some((m) => /exports checkout/.test(m.text)));
  for (const m of found) assert.ok(m.source.file && m.source.line, 'every memory has provenance');
});

test('ingest: nothing invented from an empty file set', () => {
  const found = ingestDirectory(FIXTURE);
  assert.ok(found.length >= 8, `expected >=8 memories, got ${found.length}`);
  assert.ok(!found.some((m) => /Kubernetes/.test(m.text)));
});

test('ingest: structure extracts exports and resolves test imports', () => {
  const structure = extractStructure(FIXTURE);
  const shop = structure.find((f) => f.path === 'shop.js');
  assert.ok(shop, 'shop.js in structure');
  assert.ok(shop.exports.some((e) => e.name === 'checkout' && e.kind === 'function'));
  assert.ok(shop.exports.some((e) => e.name === 'legacyCartTotal'));
  const testFile = structure.find((f) => f.path === 'tests/checkout.test.js');
  assert.ok(testFile, 'test file in structure');
  assert.ok(testFile.imports.some((i) => i.names.includes('checkout') && i.resolved === 'shop.js'));
});

test('ingest: ingestRepo returns memories + structure together', () => {
  const { memories, structure } = ingestRepo(FIXTURE);
  assert.ok(memories.length >= 8);
  assert.ok(structure.length >= 3);
});
