// Recall — rank memories for a question, and say what is missing.
//
// Deterministic, no LLM: token overlap + recency + confidence + type boost,
// plus a GRAPH boost Relate makes possible: a memory whose RELATED_TO
// neighbours also match the question scores higher, because the graph
// says its context agrees. Every result carries its score and provenance
// so the caller can show *why* a memory was recalled. When nothing
// matches, the caller gets an explicit `missing` note instead of silence.

import { MEMORY_TYPES } from './graph-store.js';

export function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9_][a-z0-9_\-.]*/g) || [])
    .filter((t) => t.length > 2)
    .filter((t) => !STOPWORDS.has(t));
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'how', 'what', 'why', 'when', 'where', 'does',
  'this', 'that', 'from', 'into', 'about', 'which', 'should', 'would', 'could',
  'there', 'here', 'your', 'you', 'are', 'was', 'were', 'been', 'have', 'has',
  'will', 'can', 'not', 'but', 'all', 'any', 'our', 'its', 'use', 'used',
]);

const TYPE_BOOST = { decision: 1.25, gotcha: 1.25, convention: 1.15, fact: 1.0, preference: 1.0, todo: 0.9 };

function scoreMemory(queryTokens, mem, now) {
  const memTokens = new Set(tokenize(mem.text));
  let overlap = 0;
  for (const t of queryTokens) if (memTokens.has(t)) overlap++;
  if (overlap === 0) return 0;
  const coverage = overlap / Math.max(1, queryTokens.length);
  const ageDays = Math.max(0, (now - new Date(mem.createdAt)) / 86400000);
  const recency = 1 / (1 + ageDays / 30); // halves every ~30 days
  const raw = coverage * (0.5 + 0.5 * mem.confidence) * recency * (TYPE_BOOST[mem.type] ?? 1);
  return Math.min(1, Math.round(raw * 1000) / 1000);
}

/**
 * context_search equivalent over the graph store.
 * Returns { results: [{ memory, score, matched, graphBoost }], missing }.
 */
export function recall(store, query, { limit = 5, includePrivate = true } = {}) {
  const queryTokens = tokenize(query);
  const now = Date.now();
  const candidates = store.list().filter((m) => includePrivate || m.scope === 'shared');
  const scored = candidates
    .map((mem) => {
      const score = scoreMemory(queryTokens, mem, now);
      const matched = queryTokens.filter((t) => tokenize(mem.text).includes(t));
      return { memory: mem, score, matched, graphBoost: 0 };
    })
    .filter((r) => r.score > 0);
  // Graph boost: a match whose RELATED_TO neighbours also match gets
  // +10% per agreeing neighbour (capped at +30%). The graph, not just
  // the text, vouches for it.
  const matchedIds = new Set(scored.map((r) => r.memory.id));
  for (const r of scored) {
    const neighbours = store.relatedIds(r.memory.id);
    const agreeing = neighbours.filter((id) => matchedIds.has(id)).length;
    r.graphBoost = Math.min(0.3, 0.1 * agreeing);
    r.score = Math.min(1, Math.round(r.score * (1 + r.graphBoost) * 1000) / 1000);
  }
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, limit);
  const missing =
    results.length === 0
      ? `No stored memory matches "${query}". Nothing was invented — ask the project, or record the answer as a new memory once known.`
      : null;
  return { results, missing };
}

/** One-paragraph brief for a question: top memories + gaps, plain text. */
export function renderBrief(store, query, opts) {
  const { results, missing } = recall(store, query, opts);
  if (missing) return missing;
  const lines = results.map(
    (r, i) =>
      `${i + 1}. [${r.memory.type} · score ${r.score}${r.graphBoost ? ` · graph +${Math.round(r.graphBoost * 100)}%` : ''} · ${r.memory.scope}] ${r.memory.text}` +
      (r.memory.source?.file ? ` (source: ${r.memory.source.file}${r.memory.source.line ? ':' + r.memory.source.line : ''})` : ''),
  );
  return `What the codebase remembers about "${query}":\n${lines.join('\n')}`;
}

export { MEMORY_TYPES };
