// Trace — follow the graph from a symbol (or a test) to what the
// codebase remembers about it.
//
// This is the query a flat memory store cannot answer: "why did this
// test fail?" A test imports a symbol; the symbol is exported by a file;
// the file has decisions, gotchas and conventions written about it; and
// neighbouring memories in the same file add context. One traversal
// returns the whole chain, each hop labelled with how it was reached.

/**
 * Trace a symbol through the graph.
 * Returns { symbol, definedIn, testedBy, memories, path } where each
 * memory carries `hop` (1 = about the symbol or its file, 2 = related
 * to a hop-1 memory) and `via` (the relationship chain that found it).
 * Empty memories + null file = "nothing stored about this symbol".
 */
export function traceSymbol(store, name) {
  const conn = store.conn;
  const defined = conn.query(
    `MATCH (f:File)-[:EXPORTS]->(s:Symbol {name: $name})
     RETURN f.path AS file`,
    { name },
  ).rows;
  const testedBy = conn.query(
    `MATCH (f:File)-[:TESTS]->(s:Symbol {name: $name})
     RETURN f.path AS file`,
    { name },
  ).rows.map((r) => r.file);

  const memories = [];
  const seen = new Set();
  const push = (mem, hop, via) => {
    if (seen.has(mem.id)) return;
    seen.add(mem.id);
    memories.push({ ...mem, hop, via });
  };

  // Hop 1a: memories that MENTION the symbol.
  for (const row of conn.query(
    `MATCH (m:Memory)-[:MENTIONS]->(s:Symbol {name: $name})
     WHERE m.supersededBy IS NULL RETURN m`,
    { name },
  ).rows) {
    push(rowToMemory(row), 1, `MENTIONS ${name}`);
  }
  // Hop 1b: memories ABOUT the file(s) that define the symbol.
  for (const d of defined) {
    for (const row of conn.query(
      `MATCH (m:Memory)-[:ABOUT]->(f:File {path: $file})
       WHERE m.supersededBy IS NULL RETURN m`,
      { file: d.file },
    ).rows) {
      push(rowToMemory(row), 1, `ABOUT ${d.file}`);
    }
  }
  // Hop 2: RELATED_TO neighbours of hop-1 memories.
  const hop1 = memories.filter((m) => m.hop === 1);
  for (const m of hop1) {
    for (const id of store.relatedIds(m.id)) {
      const neighbour = store.get(id);
      if (neighbour) push(neighbour, 2, `RELATED_TO ${m.id}`);
    }
  }

  const path = [];
  if (testedBy.length) path.push(`Test ${testedBy[0]} -[:TESTS]-> ${name}`);
  if (defined.length) path.push(`${name} <-[:EXPORTS]- ${defined[0].file}`);
  else path.push(`${name} (no defining file in the graph)`);
  for (const m of memories) path.push(`${m.via} -> [${m.type}] ${m.text.slice(0, 80)}`);

  return {
    symbol: name,
    definedIn: defined.length ? defined[0].file : null,
    testedBy,
    memories,
    path,
  };
}

/** Trace a whole file: every memory about it + its symbols' memories. */
export function traceFile(store, filePath) {
  const conn = store.conn;
  const memories = [];
  const seen = new Set();
  for (const row of conn.query(
    `MATCH (m:Memory)-[:ABOUT]->(f:File {path: $file})
     WHERE m.supersededBy IS NULL RETURN m`,
    { file: filePath },
  ).rows) {
    const mem = rowToMemory(row);
    if (!seen.has(mem.id)) { seen.add(mem.id); memories.push({ ...mem, hop: 1, via: `ABOUT ${filePath}` }); }
  }
  const symbols = conn.query(
    `MATCH (f:File {path: $file})-[:EXPORTS]->(s:Symbol) RETURN s.name AS name`,
    { file: filePath },
  ).rows.map((r) => r.name);
  const traces = symbols.map((s) => traceSymbol(store, s));
  return { file: filePath, symbols, memories, symbolTraces: traces };
}

function rowToMemory(row) {
  const p = row.m.properties;
  return {
    id: p.id,
    text: p.text,
    type: p.type,
    confidence: p.confidence,
    scope: p.scope,
    agentId: p.agentId ?? 'codememory',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    supersededBy: p.supersededBy ?? null,
    source: p.sourceFile ? { file: p.sourceFile, line: p.sourceLine ?? null, origin: p.sourceOrigin ?? 'ingest', symbol: p.sourceSymbol ?? null } : null,
  };
}
