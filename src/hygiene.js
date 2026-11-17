// Memory hygiene — never store a secret.
//
// Mirrors the pattern from Yugabyte's Jev/Meko example: before an agent
// writes to memory, check the text for credentials. A blocked write is
// reported, never silently stored, never silently dropped.
// (Ported from the ContextCon/CodeMemory scaffold.)

const SECRET_PATTERNS = [
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private-key-block', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'github-pat', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: 'generic-api-key', re: /\b(?:api[_-]?key|apikey|secret|token|password|passwd|pwd)\s*[:=]\s*['"]?[A-Za-z0-9_\-./+]{8,}['"]?/i },
  { name: 'bearer-token', re: /\bBearer\s+[A-Za-z0-9_\-]{16,}/ },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/ },
  { name: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'stripe-key', re: /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
];

/** Returns { ok: true } or { ok: false, reason, pattern }. */
export function checkMemoryText(text) {
  if (typeof text !== 'string') return { ok: false, reason: 'memory text must be a string' };
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(text)) {
      return { ok: false, reason: `refused: text looks like it contains a ${name}`, pattern: name };
    }
  }
  return { ok: true };
}

/** Convenience guard: throws on a secret, returns the text otherwise. */
export function assertSafeMemoryText(text) {
  const check = checkMemoryText(text);
  if (!check.ok) throw new Error(check.reason);
  return text;
}
