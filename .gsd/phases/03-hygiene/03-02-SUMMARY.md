# 03-02 Summary: Migrate console.error to Logger

**Plan:** 03-02  
**Phase:** 03-hygiene  
**Status:** Complete  
**Commit:** `9f469d9`

## What Was Done

Replaced all `console.error` (and `console.warn`) calls in server-side files with the structured `logger.error` / `logger.warn` interface.

Logger signature: `logger.error(context: LogContext, message: string)` — context object first, message string second.

## Scope

Originally planned for `src/lib/server/*.ts` and `src/routes/api/**/*.ts` — expanded to cover all server-side route files where `console.error` was found.

## Files Modified

### `src/lib/server/`

| File                  | Changes                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `card-identity.ts`    | Added logger import; replaced 4 `console.error` calls                    |
| `gphoto-converter.ts` | Added logger import; replaced 2 `console.warn` + 3 `console.error` calls |
| `user-profile.ts`     | Added logger import; replaced 2 `console.error` calls                    |

### `src/routes/api/` (30+ files)

All API server files — including profile, orders, cart, admin (users, config, sync-alerts, orders, pricing, inventory, exports), import/search, and import/deck.

### `src/routes/` (page servers and auth)

| File                              | Changes                                        |
| --------------------------------- | ---------------------------------------------- |
| `+page.server.ts`                 | Added logger; replaced 2 `console.error` calls |
| `admin/users/+page.server.ts`     | Added logger; replaced 1 console.error         |
| `admin/inventory/+page.server.ts` | Added logger; replaced 1 console.error         |
| `auth/callback/+server.ts`        | Added logger; replaced 1 console.error         |

## Verification

- `npm run check`: `svelte-check found 0 errors and 0 warnings`
- `grep console.error src/lib/server/**/*.ts` — only match is `logger.ts` itself
- `grep console.error src/routes/**/*.ts` — zero matches
