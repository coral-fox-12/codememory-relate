import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { GraphMemoryStore } from '../src/graph-store.js';
import { createApp } from '../src/server.js';

async function startServer() {
  const store = new GraphMemoryStore(':memory:');
  const server = createApp(store);
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base, store };
}

test('server: recall + trace + graph endpoints work end to end', async () => {
  const { server, base, store } = await startServer();
  try {
    const mem = await (await fetch(`${base}/api/memories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Auth uses JWT in the Authorization header', type: 'decision' }),
    })).json();
    assert.ok(mem.id);

    const recalled = await (await fetch(`${base}/api/recall?q=how%20do%20we%20handle%20auth`)).json();
    assert.equal(recalled.missing, null);
    assert.match(recalled.results[0].memory.text, /JWT/);

    const trace = await (await fetch(`${base}/api/trace?symbol=login`)).json();
    assert.equal(trace.symbol, 'login');
    assert.equal(trace.memories.length, 0); // no file/symbol edges yet — honest empty

    const stats = await (await fetch(`${base}/api/stats`)).json();
    assert.equal(stats.memories, 1);
    assert.ok(stats.nodes.some((n) => n.label === 'Memory'));

    const graph = await (await fetch(`${base}/api/graph`)).json();
    assert.ok(graph.nodes.length >= 1);

    const promoted = await (await fetch(`${base}/api/memories/${mem.id}/promote`, { method: 'POST' })).json();
    assert.equal(promoted.scope, 'shared');

    const bad = await fetch(`${base}/api/memories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'api_key = "sk_live_abcdefghijklmnop"' }),
    });
    assert.equal(bad.status, 400);

    const missing = await (await fetch(`${base}/api/recall`)).json();
    assert.equal(missing.error, 'query param q is required');
    void store;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('server: ingest endpoint wires memories + structure into the graph', async () => {
  const { server, base } = await startServer();
  try {
    const fixture = join(process.cwd(), 'demo', 'fixture-repo');
    const res = await (await fetch(`${base}/api/ingest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir: fixture }),
    })).json();
    assert.ok(res.stored >= 8, `expected >=8 stored, got ${res.stored}`);
    assert.ok(res.files >= 3);
    const trace = await (await fetch(`${base}/api/trace?symbol=checkout`)).json();
    assert.equal(trace.definedIn, 'shop.js');
    assert.ok(trace.testedBy.includes('tests/checkout.test.js'));
    assert.ok(trace.memories.some((m) => /floats/.test(m.text)));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
