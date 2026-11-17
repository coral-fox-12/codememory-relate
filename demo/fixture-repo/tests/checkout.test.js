// DEMO fixture — invented code for the CodeMemory demo.
import { checkout } from '../shop.js';

const paid = { id: 'ord_1', paid: true, items: [] };

// This test exists so the trace demo has a real path to follow:
// tests/checkout.test.js -[:TESTS]-> checkout -[:EXPORTS]- shop.js,
// and shop.js has the gotcha about floats and the NEVER-mutate rule.
console.log('checkout(paid) throws:', (() => { try { checkout(paid); return 'no throw'; } catch (e) { return e.message; } })());
console.log('checkout is imported from shop.js — trace it with: npm run trace checkout');
