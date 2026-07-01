# CORS Fix Plan

## Status: PASS — No changes required

## Verification Goals

- [x] No wildcard `Access-Control-Allow-Origin: *` header in server code (CONFIRMED — no CORS headers set at all)
- [x] No `credentials: true` combined with `origin: '*'` (CONFIRMED — N/A)
- [ ] Supabase CORS allowlist verified in Dashboard (manual verification required)

## Manual Verification (for the human)

1. Log into Supabase Dashboard → Project → Settings → API
2. Check CORS: Allowed Origins
3. Ensure only your production domain and `http://localhost:5173` (or your dev port) are listed
4. Remove any wildcard (`*`) entries

Test that the API rejects cross-origin requests (when testing, make a cross-origin AJAX request from another domain):
```javascript
// Run from browser console on a different domain (e.g., example.com)
fetch('https://your-app.vercel.app/api/orders', {
  method: 'POST',
  credentials: 'include',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({})
})
// Expected: TypeError (CORS policy blocks the request)
```
