// CodeMemory server on Relate — zero-dependency HTTP API + demo UI.
//
//   GET  /                     demo UI
//   GET  /api/recall?q=...     ranked memories for a question (+ explicit `missing`)
//   GET  /api/trace?symbol=..  multi-hop trace: test -> symbol -> file -> memories
//   GET  /api/trace?file=...   every memory about a file + its symbols
//   GET  /api/graph            whole graph as nodes + edges (judge inspection)
//   GET  /api/stats            node/edge counts by kind
//   GET  /api/memories         list stored memories
//   POST /api/memories         { text, type?, source? }  (hygiene-checked)
//   POST /api/memories/:id/promote
//   POST /api/ingest           { dir }  (scans a local directory into the graph)
//
// Storage: a Relate single-file store (default ./data/graph.rl). No server,
// no signup — the .rl file IS the database, and it ships in the repo so
// judges can open it with `relate --database ./data/graph.rl`.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GraphMemoryStore, openStore } from './graph-store.js';
import { recall, renderBrief } from './retrieve.js';
import { traceSymbol, traceFile } from './trace.js';
import { ingestRepo } from './ingest.js';
import { checkMemoryText } from './hygiene.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STORE_PATH = process.env.CODEMEMORY_STORE || join(ROOT, 'data', 'graph.rl');
const PORT = Number(process.env.PORT || 8080);

export function createApp(store) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, body, type = 'application/json') => {
      const payload = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
      res.writeHead(status, { 'Content-Type': type });
      res.end(payload);
    };
    const readBody = () =>
      new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (c) => (data += c));
        req.on('end', () => {
          try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
        });
      });

    try {
      if (req.method === 'GET' && url.pathname === '/') {
        return send(200, readFileSync(join(ROOT, 'public', 'index.html'), 'utf8'), 'text/html');
      }
      if (req.method === 'GET' && url.pathname === '/api/memories') {
        return send(200, { count: store.count(), memories: store.list() });
      }
      if (req.method === 'GET' && url.pathname === '/api/stats') {
        return send(200, store.stats());
      }
      if (req.method === 'GET' && url.pathname === '/api/graph') {
        return send(200, store.graph());
      }
      if (req.method === 'GET' && url.pathname === '/api/recall') {
        const q = url.searchParams.get('q') || '';
        if (!q.trim()) return send(400, { error: 'query param q is required' });
        return send(200, recall(store, q, { limit: Number(url.searchParams.get('limit') || 5) }));
      }
      if (req.method === 'GET' && url.pathname === '/api/brief') {
        const q = url.searchParams.get('q') || '';
        if (!q.trim()) return send(400, { error: 'query param q is required' });
        return send(200, renderBrief(store, q), 'text/plain');
      }
      if (req.method === 'GET' && url.pathname === '/api/trace') {
        const symbol = url.searchParams.get('symbol');
        const file = url.searchParams.get('file');
        if (symbol) return send(200, traceSymbol(store, symbol));
        if (file) return send(200, traceFile(store, file));
        return send(400, { error: 'query param symbol or file is required' });
      }
      if (req.method === 'POST' && url.pathname === '/api/memories') {
        const body = await readBody();
        const check = checkMemoryText(body.text || '');
        if (!check.ok) return send(400, { error: check.reason });
        const mem = store.add({ text: body.text, type: body.type || 'fact', source: body.source || { origin: 'manual' }, confidence: body.confidence ?? 0.7 });
        return send(201, mem);
      }
      const promoteMatch = url.pathname.match(/^\/api\/memories\/([^/]+)\/promote$/);
      if (req.method === 'POST' && promoteMatch) {
        try {
          return send(200, store.promote(decodeURIComponent(promoteMatch[1])));
        } catch (e) {
          return send(404, { error: e.message });
        }
      }
      if (req.method === 'POST' && url.pathname === '/api/ingest') {
        const body = await readBody();
        if (!body.dir) return send(400, { error: 'dir is required' });
        const { memories, structure } = ingestRepo(body.dir);
        const stored = [];
        const blocked = [];
        for (const m of memories) {
          const check = checkMemoryText(m.text);
          if (!check.ok) { blocked.push({ text: m.text, reason: check.reason }); continue; }
          stored.push(store.add(m));
        }
        // Same-file memories are RELATED_TO neighbours (graph recall boost).
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
        return send(200, { scanned: memories.length, stored: stored.length, blocked, files: structure.length, memories: stored });
      }
      return send(404, { error: 'not found' });
    } catch (e) {
      return send(500, { error: e.message });
    }
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const store = openStore(STORE_PATH);
  const server = createApp(store);
  server.listen(PORT, () => {
    console.log(`CodeMemory on Relate listening on http://localhost:${PORT} — ${store.count()} memories in ${store.persistent ? STORE_PATH : ':memory:'}`);
  });
}
