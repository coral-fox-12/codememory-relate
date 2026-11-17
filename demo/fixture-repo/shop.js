// DEMO fixture — invented code for the CodeMemory demo.
import { respond } from './respond.js';

// DECISION: auth is JWT in the Authorization header; we dropped sessions in v2
// because mobile clients kept losing cookies.
export async function checkout(order) {
  // TODO: retry the payment gateway once on a 5xx before failing the order.
  // FIXME: tax is computed in floats here — must move to integer cents.
  // NEVER mutate a paid order; create a refund instead.
  if (order.paid) throw new Error('paid orders are immutable');
  return respond({ ok: true, orderId: order.id });
}

// HACK: the legacy /v1/cart endpoint returns prices in dollars, not cents.
// Convert before returning or the frontend shows 100x prices.
export function legacyCartTotal(cart) {
  return cart.items.reduce((s, i) => s + i.priceCents, 0);
}
