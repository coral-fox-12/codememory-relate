// DEMO fixture — invented code for the CodeMemory demo.
export function respond(payload) {
  return { ...payload, at: new Date().toISOString() };
}
