# SSRF Fix Plan

## Status: PASS — No changes required

## Verification Goals

- [x] No user-supplied URL is directly fetched by the server (CONFIRMED)
- [x] Google Sheets URL is operator-controlled env var (CONFIRMED)
- [x] Moxfield/Archidekt: only deck ID is extracted and interpolated into hardcoded URLs (CONFIRMED)
- [x] No image proxy or arbitrary URL feature exists (CONFIRMED)

## Manual Verification (for the human)

Not applicable — no user-supplied URL fetching exists.

## Future Guidance

If a user-supplied URL fetch feature is added, implement:
1. Block private IP ranges: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, ::1
2. Allow only `http` and `https` schemes
3. Resolve hostname and verify IP BEFORE making the request (prevent DNS rebinding)
4. Use a library like `ssrf-req-filter` or implement the check manually
