# FILE_UPLOADS Security Report

## Status: PASS (N/A — no file upload feature exists)

## Findings

### No File Upload Endpoints

Searched all API routes for multipart form data handling, `formData()`, `FileList`, file type checking, and file storage operations. **Zero file upload functionality found.**

The application does not have any file upload feature. Card images are sourced from external URLs (Google Photos/Supabase storage, synced by admins via the inventory sync feature). Users cannot upload any files.

### Bulk Tracking Upload (CSV)

The admin bulk-tracking feature accepts CSV data, but the CSV is parsed **client-side** (the Svelte component reads the file and sends JSON to the API). The server only receives JSON, not a raw file. This is safe.

### Deck Import

The deck import feature accepts a URL (not a file). The URL is fetched by the server from hardcoded external APIs. No file bytes are uploaded.

## What's at Risk

Nothing — no file uploads exist.

## Recommendations

1. No action required.
2. If file uploads are added in the future (e.g., card image uploads, CSV inventory uploads), implement:
   - File type validation by magic bytes (not filename extension)
   - Rename all uploads to UUIDs server-side
   - Store on Supabase Storage (separate domain) — never on the app origin
   - Virus scanning for executable file types
