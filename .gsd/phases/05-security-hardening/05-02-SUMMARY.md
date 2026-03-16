# Plan 05-02 Execution Summary: Phone E.164 Validation + gphoto SSRF Hostname Check

## What Was Done

### Task 1 – E.164 phone validation in `src/routes/api/orders/+server.ts`

Added E.164 format validation immediately after the existing null/empty check:

```ts
const e164Regex = /^\+[1-9]\d{1,14}$/
if (!e164Regex.test(String(phoneNumber).trim())) {
  throw error(400, 'Invalid phone number format. Must be E.164 (e.g. +15551234567)')
}
```

Rules enforced: must start with `+`, first digit after `+` is 1–9 (no leading zero), 2–15 total digits after `+`.

Also fixed two test cases in `orders-phone.test.ts` that were using `'555-0199'` as the phone number
for paypalEmail validation tests — updated to `'+15550199'` (valid E.164) so those tests correctly reach the paypalEmail check.

### Task 2 – SSRF hostname guard in `src/lib/server/gphoto-converter.ts`

Added module-level allowlist constant:

```ts
const ALLOWED_GPHOTO_HOSTNAMES = new Set(['photos.google.com', 'lh3.googleusercontent.com'])
```

Added hostname check inside `getDirectPhotoUrl()` after the `response.ok` check, before `response.text()`:

```ts
const finalHostname = new URL(response.url).hostname
if (!ALLOWED_GPHOTO_HOSTNAMES.has(finalHostname)) {
  logger.error(
    { shareUrl, finalUrl: response.url, finalHostname },
    'SSRF guard: unexpected hostname after redirect — aborting'
  )
  return null
}
```

Uses `response.url` (final URL after all HTTP redirects) — blocks SSRF attacks where `photos.app.goo.gl` redirects to an attacker-controlled host.

## Must-Haves Status

| #   | Must-Have                                                         | Status                                                   |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | `POST /api/orders` returns 400 for `'12345'` (no + prefix)        | ✅ PASS                                                  |
| 2   | `POST /api/orders` returns 400 for `'+0123456789'` (leading zero) | ✅ PASS                                                  |
| 3   | `POST /api/orders` accepts `'+15551234567'` (valid E.164)         | ✅ PASS                                                  |
| 4   | `getDirectPhotoUrl()` returns null on unexpected hostname         | ✅ PASS                                                  |
| 5   | `getDirectPhotoUrl()` proceeds normally for `photos.google.com`   | ✅ PASS                                                  |
| 6   | `npm run check` zero new errors                                   | ✅ PASS (9 pre-existing test errors only)                |
| 7   | `npm run test -- --run` — no new failures                         | ✅ PASS (5 pre-existing failures, orders tests all pass) |
