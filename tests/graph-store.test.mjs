import test from 'node:test';
import assert from 'node:assert/strict';
import { GraphMemoryStore, openStore } from '../src/graph-store.js';

// NOTE: Relate file stores memory-map the store file (MAP_SHARED|PROT_WRITE),
// which this sandbox blocks (EPERM) on every filesystem — file opens fail
// with Neo.DatabaseError.General.UnknownError while :memory: works fully.
// Tests therefore run on :memory:; the fallback is tested explicitly below.
function freshStore() {
  return { store: new GraphMemoryStore(':memory:') };
}

test('store: add / get / list / promote (one-way)', () => {
  const { store } = freshStore();
  const m = store.add({ text: 'Auth uses JWT, never sessions', type: 'decision' });
  assert.equal(m.scope, 'private');
  assert.equal(store.get(m.id).text, m.text);
  assert.equal(store.count(), 1);
  assert.equal(store.promote(m.id).scope, 'shared');
  assert.equal(store.promote(m.id).scope, 'shared'); // idempotent
  assert.equal(store.list({ scope: 'shared' }).length, 1);
  assert.equal(store.list({ scope: 'private' }).length, 0);
});

test('store: supersede keeps the old record, linked by SUPERSEDES', () => {
  const { store } = freshStore();
  const old = store.add({ text: 'Prices in floats', type: 'fact' });
  const replacement = store.supersede(old.id, { text: 'Prices in integer cents', type: 'convention' });
  assert.equal(store.get(old.id).supersededBy, replacement.id);
  assert.equal(store.count(), 1);
  assert.equal(store.list()[0].text, 'Prices in integer cents');
  const rels = store.conn.query(
    `MATCH (o:Memory {id: $old})-[:SUPERSEDES]->(n:Memory {id: $new}) RETURN count(*) AS n`,
    { old: old.id, new: replacement.id },
  ).single();
  assert.equal(rels.n, 1);
});

test('store: rejects bad input and secrets at the write boundary', () => {
  const { store } = freshStore();
  assert.throws(() => store.add({ text: '  ' }), /text is required/);
  assert.throws(() => store.add({ text: 'x', type: 'nope' }), /unknown memory type/);
  assert.throws(() => store.promote('missing'), /no memory/);
  assert.throws(() => store.add({ text: 'api_key = "sk_live_abcdefghijklmnop"' }), /refused/);
  assert.equal(store.count(), 0);
});

test('store: provenance edges are created (ABOUT + MENTIONS)', () => {
  const { store } = freshStore();
  const m = store.add({
    text: 'NEVER cache tokens in localStorage', type: 'gotcha',
    source: { file: 'src/auth.js', line: 42, origin: 'ingest', symbol: 'login' },
  });
  const about = store.conn.query(
    `MATCH (mem:Memory {id: $id})-[:ABOUT {line: 42}]->(f:File {path: 'src/auth.js'}) RETURN count(*) AS n`,
    { id: m.id },
  ).single();
  assert.equal(about.n, 1);
  const mentions = store.conn.query(
    `MATCH (mem:Memory {id: $id})-[:MENTIONS]->(s:Symbol {name: 'login'}) RETURN count(*) AS n`,
    { id: m.id },
  ).single();
  assert.equal(mentions.n, 1);
});

test('store: stats + graph expose nodes and edges', () => {
  const { store } = freshStore();
  store.add({ text: 'Auth uses JWT', type: 'decision', source: { file: 'src/auth.js', line: 1, origin: 'ingest', symbol: 'login' } });
  const stats = store.stats();
  assert.equal(stats.memories, 1);
  assert.ok(stats.nodes.some((n) => n.label === 'Memory' && n.count === 1));
  assert.ok(stats.relationships.some((r) => r.type === 'ABOUT'));
  const g = store.graph();
  assert.ok(g.nodes.length >= 3);
  assert.ok(g.edges.length >= 2);
});

test('store: openStore falls back to :memory: when file stores are blocked', () => {
  // On a normal machine this opens the file store (persistent === true).
  // In this sandbox file opens throw, so openStore must return a working
  // in-memory store instead of crashing.
  const store = openStore('/tmp/codememory-relate-fallback-test.rl');
  const m = store.add({ text: 'Fallback keeps the app working', type: 'fact' });
  assert.equal(store.get(m.id).text, m.text);
  assert.equal(store.count(), 1);
  assert.equal(typeof store.persistent, 'boolean');
});

test('store: export/import round-trips the whole graph', () => {
  const { store } = freshStore();
  const a = store.add({ text: 'Auth uses JWT', type: 'decision', source: { file: 'src/auth.js', line: 1, origin: 'ingest', symbol: 'login' } });
  const b = store.add({ text: 'Auth tokens expire after one hour', type: 'fact', source: { file: 'src/auth.js', line: 9, origin: 'ingest' } });
  store.linkRelated(a.id, b.id);
  store.addStructure([{ path: 'src/auth.js', exports: [{ name: 'login', kind: 'function', line: 3 }], imports: [] }]);
  const cypher = store.exportCypher();
  assert.match(cypher, /CREATE \(:Memory/);
  assert.match(cypher, /ABOUT/);
  assert.match(cypher, /RELATED_TO/);
  const other = new GraphMemoryStore(':memory:');
  other.importCypher(cypher);
  assert.equal(other.count(), 2);
  assert.equal(other.stats().memories, 2);
  const rels = other.conn.query(`MATCH ()-[r]->() RETURN count(r) AS n`).single().n;
  assert.ok(rels >= 4, `expected >=4 relationships after import, got ${rels}`);
  assert.ok(other.list().some((m) => /Auth uses JWT/.test(m.text)));
});
