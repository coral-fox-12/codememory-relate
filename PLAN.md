# PLAN — Relate by Neo4j Hackathon

## Verified facts (read live 2026-11-17, Devpost + official rules)

- **Hackathon:** Relate by Neo4j Hackathon, Devpost https://relate.devpost.com/
- **Theme:** "Context, Connected" — build an agent/app/tool on Relate showing how connected data makes an agent more reliable.
- **Deadline:** submissions close **6:00 PM PST Fri 11 Dec 2026 = 09:00 VN Sat 12 Dec 2026**. Judging 12–16 Dec, winners announced Thu 17 Dec 2026.
- **Prizes (hardware, NOT cash):** 1st Mac Studio M5 Max 64GB/1TB $3,799; 2nd Mac mini M6 32GB/512GB $1,499; 3rd Mac mini M6 16GB/256GB $899. Total $6,197. 3 winners only.
- **Eligibility (rules §2):** 18+, located where the contest is allowed by law; NOT in a US-embargoed/sanctioned country, not on a restricted-party list. **Vietnam is not sanctioned and not named anywhere in the rules — eligible.** Only Neo4j employees (and family/household) are prize-ineligible. Solo allowed; teams 1–4, one prize per entry.
- **Project rules (§3):** new project started on/after 11 Nov 2026 (this scaffold started 17 Nov — compliant); may reuse own earlier code / open-source libraries if disclosed (the memory model + extractor patterns are reused from our ContextCon/CodeMemory scaffold — disclosed in README); must make meaningful use of Relate (CLI, embedded, WASM, MCP, Bolt, HTTP, hybrid retrieval); public GitHub repo tagged topic `relate` (required) + `relate-neo4j-hackathon` (recommended); AI-assisted dev allowed, must describe significant AI use (disclosed in README).
- **Submission (§4):** title + description, public GitHub repo link (tagged), setup instructions, demo video up to 2 min OR working demo link + screenshots, statement of product capabilities / third-party / AI tools used.
- **Judging (page weights):** Relate/connected context 30, functionality 25, usefulness 20, docs/reproducibility 15, creativity 10. (Rules page says the five criteria are "weighted equally" — the page's point weights are more specific and are what judges see; both agree on the criteria themselves.)
- **Prize shipping (rules §6, OPEN QUESTION):** hardware ships to one address "in a country where Neo4j can lawfully ship and where the Contest is permitted. Neo4j will arrange shipping at its cost. The recipient is solely responsible for all applicable taxes, import duties, customs fees." Vietnam is not excluded in the rules text, but whether Neo4j ships a Mac to Vietnam is **unconfirmed** — check/confirm at submit time (Devpost Q&A or Neo4j contact). Recipient pays import duty. Prizes are non-transferable, no cash substitution.

## Entry concept

**CodeMemory on Relate** — "the agent that remembers the codebase". Ports the ContextCon/CodeMemory concept (Meko datapack memory) to Relate as the graph memory layer. Differentiator vs the flat store: multi-hop trace (test → symbol → file → decisions/gotchas) + graph-boosted recall. Directly on-theme: connected context is the product.

## Status (2026-11-17)

- [x] Verification live (rules, eligibility, prizes, shipping caveat)
- [x] Relate learned: @relate/relate 1.0.2 (Node), Cypher 25, single-file `.rl` store, CLI/MCP available
- [x] Scaffold: `~/workspace/devpost/relate-neo4j/` — tests **20/20 PASS**, demo ingests 13 memories (20 nodes, 48 rels), server smoke-tested (recall + trace + stats on the real store)
- [x] Persistent store `data/graph.rl` built + verified (reopened read-only: 13 memories, 20 nodes, 48 rels) + `data/seed.cypher` (replay-verified) + `data/graph.json`
- [ ] GitHub repo (push + topics) — next step
- [ ] Demo video 1–2 min (record before 09:00 VN 12 Dec 2026)
- [ ] Devpost submit via separate account (parent handles)

## Environment notes (verified 2026-11-17)

- The build VM intermittently blocks shared writable memory mappings (`mmap` MAP_SHARED|PROT_WRITE → EPERM) in waves lasting ~a minute; Relate file stores need exactly that, so `Database.open` on a file path fails during a wave and succeeds right after (verified: 10/10 fail in a wave, then success). `:memory:` always works. The app handles it via `openStore()` fallback + seed exports. Also `write(2)` intermittently EPERM in the same waves (demo export retries 5x).
- The first probe at 01:15 worked, then a wave hit 01:16–01:24, then it cleared at 01:25 — consistent with waves, not a permanent block.
- npm registry + GitHub reachable via the proxy; `curl -o` intermittently fails to write during bad waves (use node fetch or retries).

## Open risks

1. **Prize shipping to Vietnam unconfirmed** — the only real eligibility risk. Mitigation: ask on the Devpost discussion/Q&A before the deadline; entry is still worth building (hardware EV is secondary to the build's reuse value for ContextCon).
2. **Only 3 prizes, ~450 participants** — low win probability; the build doubles as the ContextCon backend (Relate as a second memory layer), so the work is not wasted if we don't place.
3. **Demo video** needs recording (parent handles; 1–2 min screen share is enough per the rules).
