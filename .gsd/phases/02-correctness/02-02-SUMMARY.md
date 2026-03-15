# Plan 02-02 Summary: Export Race Fix + Silent Query Errors

## Status: Complete

## What Changed

### `src/lib/server/export-storage.ts`

Added a module-level promise-based mutex (`withManifestLock`) that serializes all manifest read-modify-write operations:

```typescript
let manifestLock: Promise<void> = Promise.resolve();
async function withManifestLock<T>(fn: () => Promise<T>): Promise<T> { ... }
```

All three functions that modify the manifest now wrap their R-M-W block in `withManifestLock(async () => { ... })`:

- `saveExportFile` — lock wraps `loadManifest → push → saveManifest`
- `cleanupExpiredExports` — entire function body inside lock
- `deleteExportFile` — lock wraps `loadManifest → filter → saveManifest`

Concurrent requests now queue instead of racing on the manifest file.

### `src/routes/api/import/search/+server.ts`

Added `error` to the import from `@sveltejs/kit`. All three primary card search queries now destructure and check the `error` response:

```typescript
const { data: exactMatches, error: exactErr } = await supabase...
if (exactErr) { throw error(500, 'Search unavailable') }
```

A Supabase failure now returns 500 to the caller instead of silently returning empty or partial results.

## Commit

`2d2f36a` — fix(correctness): safe manifest writes with mutex; surface search query errors
