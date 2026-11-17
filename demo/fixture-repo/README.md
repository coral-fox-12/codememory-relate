# demo-shop — a tiny invented shop (DEMO data only)
#
# This repo exists only so the CodeMemory demo has something real to
# ingest. Every fact in it is invented for the demo and labelled DEMO.

A demo shop API. Auth uses JWT, never sessions. Orders are immutable
once paid — NEVER mutate a paid order, refund it instead.

## Rules
- RULE: prices are always stored in integer cents, never floats.
- RULE: every API response goes through `respond()` so errors look the same.
