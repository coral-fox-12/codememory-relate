# CodeMemory on Relate — the agent that remembers the codebase

One-line pitch: a coding assistant that never forgets your codebase, because its memory is a graph.

Built for the **Relate by Neo4j Hackathon** (Devpost, theme "Context, Connected", deadline 09:00 VN Sat 12 Dec 2026).

## Use case

A coding agent forgets everything about your codebase every time the session ends. CodeMemory fixes that: it ingests a repo into durable memories — decisions, conventions, gotchas, TODOs — and recalls them with scores and provenance. What makes this entry different from a flat memory list is the **trace**: ask why a test would fail and CodeMemory walks the graph — test → symbol → file → every decision and gotcha written about that file — in one traversal. A keyword index cannot answer that question; a graph can.

## How it uses Relate

- **Mode: single file** (`data/graph.rl`). One file holds the whole graph, WAL included. Chosen because judges can clone the repo and open the exact store the demo built — no server, no signup, nothing to deploy.
- **Why this mode:** the hackathon asks for "a persistent Relate store judges can inspect". A single `.rl` file is the most inspectable form: `relate --database ./data/graph.rl --read-only` opens it. `data/seed.cypher` (the same graph as Cypher) and `data/graph.json` (nodes + edges) ship alongside for anyone who wants to replay or eyeball it without the CLI.
- **What the graph models:**
  - `(:Memory {id, text, type, confidence, scope, createdAt})` — one durable fact; types: fact, decision, convention, gotcha, preference, todo.
  - `(:File {path})`, `(:Symbol {name, kind})` — the codebase's structure.
  - `(:Memory)-[:ABOUT {line}]->(:File)` — provenance: where the fact came from.
  - `(:Memory)-[:MENTIONS]->(:Symbol)` — the fact is about this symbol.
  - `(:File)-[:EXPORTS]->(:Symbol)`, `(:File)-[:TESTS {line}]->(:Symbol)` — a test file imports the symbol it covers.
  - `(:Memory)-[:RELATED_TO]->(:Memory)` — memories from the same file; recall boosts a match when its graph neighbours agree (+10% per agreeing neighbour, capped +30%).
  - `(:Memory)-[:SUPERSEDES]->(:Memory)` — contradiction history; the old record stays for audit, never deleted.
- **AI use:** this project was built with AI coding assistance (Muse). All logic, tests and docs were reviewed and verified by running them; no model is called at runtime — recall is deterministic (token overlap + recency + confidence + type boost + graph boost). No third-party services are used at all: Relate is the only dependency besides Node.js itself.

## Setup and run

Prerequisites: Node.js 18+ (tested on Node 24), npm. No server, no account, no API key.

```bash
npm install   # installs @relate/relate (the embedded engine)
npm test      # 20 tests, all passing
npm run demo  # ingest the DEMO fixture repo, run recall + trace, rebuild data/graph.rl
npm start     # server on http://localhost:8080 (demo UI + JSON API)
```

API: `GET /api/recall?q=…` · `GET /api/brief?q=…` · `GET /api/trace?symbol=…` (or `?file=…`) · `GET /api/graph` · `GET /api/stats` · `GET /api/memories` · `POST /api/memories` · `POST /api/memories/:id/promote` · `POST /api/ingest { dir }`.

Try it after `npm run demo`:

```bash
# the trace that sells the entry — test -> symbol -> file -> gotcha + rule
curl "http://localhost:8080/api/trace?symbol=checkout"
# open the store the demo built, exactly as a judge would
relate --database ./data/graph.rl --read-only --mode envelope "MATCH (m:Memory)-[:ABOUT]->(f:File) RETURN m.text AS memory, f.path AS file LIMIT 5"
```

## Where the data lives

- `data/graph.rl` — the persistent Relate store built by `npm run demo` (57 KB, 13 memories, 20 nodes, 48 relationships). Magic header `MDBCLB01`.
- `data/seed.cypher` — the same graph as Cypher CREATE statements; replay with `relate --database ./data/graph.rl --load ./data/seed.cypher`.
- `data/graph.json` — nodes + edges as JSON.
- `demo/fixture-repo/` — an invented demo shop (labelled DEMO everywhere). Nothing in it is presented as a real project.

## Honesty notes

- The bundled fixture repo is invented data, labelled DEMO everywhere.
- Recall never invents: a question with no matching memory returns an explicit "nothing stored" note.
- A memory containing a credential (API key, token, private key, password) is refused at the write boundary (`src/hygiene.js`) — never silently stored.
- This project reuses the memory model and extractor patterns from our earlier ContextCon entry (CodeMemory on Meko, same concept, different backend — disclosed per the rules, only work done during this contest period is judged). The Relate graph layer, trace, and server are new for this hackathon.
- **Sandbox note (verified 2026-11-17):** the VM this was built on intermittently blocks shared writable memory mappings (EPERM waves lasting ~a minute), which Relate's file stores need — file opens fail during a wave and succeed right after. The app handles it: `openStore()` falls back to an in-memory Relate store with a clear warning, and the demo exports `seed.cypher` + `graph.json` so the graph is never lost. On a normal machine the file store opens every time. This does not affect judges: `data/graph.rl` in the repo was built and verified on this machine during a good wave (reopened read-only: 13 memories, 20 nodes, 48 relationships).

## Submission checklist (Devpost)

- [x] Public GitHub repo tagged with topic `relate` (+ `relate-neo4j-hackathon`)
- [x] README answers "how are you using Relate, and why?" (above)
- [x] Persistent Relate store judges can inspect (`data/graph.rl` + seed + JSON)
- [x] Working code with Relate actually running (`npm test`, `npm run demo`, `npm start`)
- [ ] Demo video, 1–2 minutes (to record before 09:00 VN 12 Dec 2026)
- [ ] Devpost submit (parent handles, separate account)

See `PLAN.md` for verified competition facts, open risks, and the submission checklist.
