# Plan 01-01 Summary: Fix Open Redirect in Auth Callback + Conflict Page

## Status: Complete

## What Changed

### `src/routes/auth/callback/+server.ts`

- Replaced single-line `const next = url.searchParams.get('next') ?? '/'` with two-line sanitized version
- `rawNext` is read from params; `next` is only trusted if it starts with `/` and NOT `//`
- External URLs (`https://evil.com`) and protocol-relative URLs (`//evil.com`) now resolve to `/`
- Relative paths like `/profile`, `/orders/123` pass through unchanged

### `src/routes/profile/conflict/+page.server.ts`

- Same pattern applied to `returnTo` param
- Invalid/external values fall back to `/profile` instead of `/`

## How It Works

```typescript
const rawNext = url.searchParams.get('next') ?? '/'
const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
```

This single check rejects:

- Absolute URLs (`https://evil.com`) — don't start with `/`
- Protocol-relative URLs (`//evil.com`) — start with `//`

It allows:

- Same-origin relative paths (`/profile`, `/orders/abc`)

## Commit

`4b77d77` — fix(security): sanitize open redirect in auth callback and conflict page
