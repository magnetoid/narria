// Stub for the `server-only` package so `lib/db/*` and `lib/ai/*` — which
// import it to prevent client bundling — are importable from Vitest (Node, no bundler).
export {};
