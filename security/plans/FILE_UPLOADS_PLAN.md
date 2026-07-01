# FILE_UPLOADS Fix Plan

## Status: PASS (N/A) — No changes required

## Verification Goals

- [x] No file upload endpoints exist (CONFIRMED)
- [x] Bulk tracking CSV is parsed client-side, JSON sent to server (CONFIRMED)
- [x] Deck import uses URL + server-side fetch, not file upload (CONFIRMED)

## Future Guidance

If file uploads are added, follow these rules:
1. Validate file type by reading first few bytes (magic bytes), not filename extension
2. Rename all uploaded files to UUID on the server: `${crypto.randomUUID()}.${ext}`
3. Store uploads in Supabase Storage (served from separate domain) — never in the app's static directory
4. Limit file size in middleware before parsing
5. For images: use Supabase Image Transformation API to re-encode before serving
