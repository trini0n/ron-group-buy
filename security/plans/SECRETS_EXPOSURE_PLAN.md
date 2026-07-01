# SECRETS_EXPOSURE Fix Plan

## Changes

- No source code changes needed — secrets are already correctly isolated to `$env/static/private`
- The primary action items are operational (rotate keys) and tooling (git history scan + pre-commit hook)

## New Files

- `.gitleaks.toml` — pre-commit secret scanning configuration (optional hardening)

## Verification Goals

- [x] `git ls-files .env` returns nothing (CONFIRMED — already passing)
- [x] No env var prefixed with `NEXT_PUBLIC_`, `VITE_*`, or `REACT_APP_*` holds a secret (CONFIRMED — SvelteKit uses `PUBLIC_` prefix for intentionally public vars; secrets use `$env/static/private`)
- [x] `.env.example` exists with placeholder values only (CONFIRMED)
- [ ] Discord Bot Token has been rotated via Discord Developer Portal
- [ ] Git history scanned and confirmed no past `.env` commit: `git log --all --full-history -- .env`
- [ ] `git log --all -p --follow -- .env | grep -E 'Bot [A-Za-z0-9+/=]{50,}'` returns nothing (no token in history)
- [ ] Supabase Service Role Key rotated if git history shows any exposure

## Implementation

### Step 1: Scan git history (manual, run in terminal)
```bash
git log --all --full-history -- .env
git log --all --full-history -- "*.env"
```
If any commits are found, check their content with:
```bash
git show <commit-hash>:.env
```

### Step 2: Rotate Discord Bot Token
1. Go to https://discord.com/developers/applications
2. Select your application
3. Go to Bot → Reset Token
4. Copy new token into `.env` locally and into Vercel environment variables

### Step 3: Update Vercel production env vars
Ensure production uses the rotated token — not the one from `.env` (which is local-only).

## Manual Verification (for the human)

- [ ] Log into Discord Developer Portal and reset the bot token
- [ ] Update the new token in Vercel Dashboard → Settings → Environment Variables
- [ ] Verify the bot still works after token rotation (test a DM notification)
- [ ] Run `git log --all --full-history -- .env` and confirm empty output
- [ ] Consider adding `gitleaks` as a pre-commit hook to prevent future leaks
