import test from 'node:test';
import assert from 'node:assert/strict';
import { GraphMemoryStore } from '../src/graph-store.js';
import { recall, renderBrief } from '../src/retrieve.js';
import { checkMemoryText } from '../src/hygiene.js';

function freshStore() {
  return new GraphMemoryStore(':memory:');
}

test('retrieve: ranks the right memory first, says what is missing', () => {
  const s = freshStore();
  s.add({ text: 'Auth uses JWT in the Authorization header', type: 'decision', confidence: 0.9 });
  s.add({ text: 'Prices are stored in integer cents', type: 'convention', confidence: 0.9 });
  s.add({ text: 'The office coffee machine is broken', type: 'fact', confidence: 0.9 });
  const { results, missing } = recall(s, 'how do we handle auth?');
  assert.equal(missing, null);
  assert.ok(results.length >= 1);
  assert.match(results[0].memory.text, /JWT/);
  assert.ok(results[0].score > 0);
  assert.ok(results[0].matched.length > 0);
  const none = recall(s, 'how do we deploy to Kubernetes?');
  assert.equal(none.results.length, 0);
  assert.match(none.missing, /No stored memory matches/);
  assert.match(renderBrief(s, 'how do we deploy to Kubernetes?'), /No stored memory/);
});

test('retrieve: graph boost lifts a memory whose neighbours also match', () => {
  const s = freshStore();
  const a = s.add({ text: 'Auth tokens expire after one hour', type: 'fact', confidence: 0.9 });
  const b = s.add({ text: 'Auth refresh rotates the token on expiry', type: 'fact', confidence: 0.9 });
  const c = s.add({ text: 'Prices are stored in integer cents', type: 'convention', confidence: 0.9 });
  s.linkRelated(a.id, b.id);
  const boosted = recall(s, 'auth token expiry');
  const boostedA = boosted.results.find((r) => r.memory.id === a.id);
  assert.ok(boostedA, 'auth memory recalled');
  assert.ok(boostedA.graphBoost > 0, 'neighbour agreement boosts the score');
  assert.ok(boosted.results.find((r) => r.memory.id === c.id) === undefined, 'unrelated memory not recalled');
});

test('retrieve: shared-only recall hides private memories', () => {
  const s = freshStore();
  s.add({ text: 'Auth uses JWT', type: 'decision', confidence: 0.9 });
  const { results } = recall(s, 'auth', { includePrivate: false });
  assert.equal(results.length, 0);
});

test('hygiene: secrets are refused, plain facts pass', () => {
  assert.equal(checkMemoryText('Auth uses JWT').ok, true);
  assert.equal(checkMemoryText('api_key = "sk_live_abcdefghijklmnop"').ok, false);
  assert.equal(checkMemoryText('Bearer abcdefghijklmnopqr').ok, false);
  assert.equal(checkMemoryText('-----BEGIN RSA PRIVATE KEY-----').ok, false);
  assert.equal(checkMemoryText('ghp_abcdefghij0123456789').ok, false);
});
