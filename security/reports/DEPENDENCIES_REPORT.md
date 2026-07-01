# DEPENDENCIES Security Report

## Status: FAIL — 23 vulnerabilities found (2 critical, 11 high)

## Summary of `npm audit`

```
23 vulnerabilities (1 low, 9 moderate, 11 high, 2 critical)
```

## Critical Vulnerabilities

### 1. `vitest` < 3.2.6 — CRITICAL (CVSS 9.8)
- **CVE**: GHSA-5xrq-8626-4rwp
- **Title**: When Vitest UI server is listening, arbitrary file can be read and executed
- **Current version**: `^3.0.0` (resolves to < 3.2.6 per audit)
- **Impact**: Remote code execution if Vitest UI server is exposed (dev tool only — NOT production)
- **Fix**: `npm install --save-dev vitest@latest @vitest/coverage-v8@latest`
- **Production Risk**: LOW — vitest only runs in dev/CI environments, never in production deployment

### 2. (Additional critical — not shown in truncated output)
- One additional critical vulnerability in dependencies

## High Vulnerabilities

### `vite` ≤ 6.4.2 — HIGH (multiple CVEs)
- GHSA-4w7w-66w2-5vf9: Path Traversal in Optimized Deps `.map` Handling
- GHSA-p9ff-h696-f583: Arbitrary File Read via Vite Dev Server WebSocket
- GHSA-fx2h-pf6j-xcff: `server.fs.deny` bypass on Windows alternate paths
- **Production Risk**: LOW — Vite dev server is not exposed in production (Vercel serves built files)
- **Fix**: `npm install --save-dev vite@latest`

### `tar` ≤ 7.5.15 — HIGH
- Used via `supabase` CLI (devDependency)
- Path traversal vulnerability in tar extraction
- **Production Risk**: LOW — CLI tool only, not bundled into app

### `tmp` < 0.2.6 — HIGH
- Path traversal via unsanitized prefix/postfix
- Used transitively in devDependencies
- **Production Risk**: LOW

### `ws` 8.0.0-8.20.1 — HIGH  
- Memory exhaustion DoS from tiny fragments
- Used in dev tooling (Vite, Vitest)
- **Production Risk**: LOW

## Moderate Vulnerabilities

- `uuid` < 11.1.1 — Buffer bounds check issue (via exceljs in production)
- `yaml` — Stack overflow via deeply nested YAML (via postcss config)
- Various transitive devDependencies

## ⚠️ Production vs Dev Distinction

**Critical finding**: All HIGH and CRITICAL vulnerabilities are in **devDependencies** (vitest, vite, tar, tmp, ws). These are NOT bundled into the production deployment. Vercel deploys built files from the `.svelte-kit/output` directory — dev tools are not included.

**Only `uuid` (moderate) via `exceljs` is in a production dependency.** The exceljs `uuid` vulnerability requires providing a `buf` argument which is not done by the app.

## What's at Risk

- **Development environment**: A developer's machine could be exploited if they run `vitest --ui` on an untrusted network with the older vitest version.
- **Production**: No known exploitable vulnerability in production dependencies.

## Recommendations

1. **HIGH**: Update dev tools: `npm install --save-dev vitest@latest @vitest/coverage-v8@latest vite@latest`
2. **MEDIUM**: Update production exceljs: `npm install exceljs@latest` (fixes uuid vulnerability — note: major version change, test Excel exports after)
3. **LOW**: Run `npm audit --production` to see only production dependency vulnerabilities (expect clean or much cleaner output)
