# DEPENDENCIES Fix Plan

## Status: FAIL — Update dev tools

## Changes

- Update `vitest` and `@vitest/coverage-v8` to fix the critical vulnerability
- Update `vite` to fix the high path traversal vulnerabilities  
- Optionally update `exceljs` for the moderate uuid issue

## Verification Goals

- [ ] `vitest` updated to ≥ 3.2.6 (critical fix)
- [ ] `vite` updated to ≥ 6.4.3 (high fix)
- [ ] `npm audit --production` returns 0 critical/high vulnerabilities
- [ ] Tests still pass after updates: `npm run test:unit`
- [ ] Build still succeeds: `npm run build`

## Implementation

### Step 1: Update dev vulnerabilities

```bash
npm install --save-dev vitest@latest @vitest/coverage-v8@latest
npm install --save-dev vite@latest
```

### Step 2: Verify tests pass

```bash
npm run test:unit
```

### Step 3: Check production-only vulnerabilities

```bash
npm audit --production
```

Expected: 0 critical, 0 high (moderate from yaml in postcss-load-config may remain as transitive)

### Step 4: Optionally fix exceljs uuid (moderate)

```bash
npm install exceljs@latest
```

**Note**: This may be a breaking change — test Excel exports after updating.

### Step 5: Pin exact versions (per AGENTS.md security rules)

After updating, pin exact versions in package.json (no `^` or `~` in production):
```bash
# Check what was installed
npm list vitest vite exceljs
```

Then update `package.json` to remove carets from production deps if needed.

## Manual Verification (for the human)

After applying fixes:
1. Run `npm audit` and confirm the critical vitest vulnerability is gone
2. Run `npm run test:ci` and confirm all tests pass
3. Run `npm run build` and confirm the build succeeds
4. Test admin export (Excel download) to confirm exceljs still works
