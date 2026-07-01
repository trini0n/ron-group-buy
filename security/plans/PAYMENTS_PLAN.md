# PAYMENTS Fix Plan

## Status: PASS (N/A) — No automated payment processing

## Verification Goals

- [x] No Stripe webhook endpoint exists (CONFIRMED — no webhook processing)
- [x] No payment SDK installed (CONFIRMED — not in package.json)
- [x] PayPal is used only for invoice email storage and URL links (CONFIRMED)
- [x] No payment secrets in frontend code (CONFIRMED — N/A)

## Optional Low-Priority Fix: PayPal Invoice URL Validation

Add URL validation to the `paypal_invoice_url` field in the admin order PATCH endpoint:

```typescript
// In src/routes/api/admin/orders/[id]/+server.ts
const body = await request.json()
const { tracking_number, tracking_carrier, admin_notes, paypal_invoice_url } = body

// Validate PayPal invoice URL if provided
if (paypal_invoice_url !== undefined && paypal_invoice_url !== null && paypal_invoice_url !== '') {
  try {
    const url = new URL(paypal_invoice_url)
    if (!['https:'].includes(url.protocol) || !url.hostname.endsWith('paypal.com')) {
      return json({ error: 'paypal_invoice_url must be a valid https://paypal.com URL' }, { status: 400 })
    }
  } catch {
    return json({ error: 'paypal_invoice_url must be a valid URL' }, { status: 400 })
  }
}
```

## Future Guidance

If Stripe or another payment processor is added:
1. Store webhook signing secret in server-side env var only
2. Verify webhook signature on EVERY webhook request before processing
3. Track processed event IDs (idempotency) to prevent duplicate processing
4. Handle the full event lifecycle: `payment_intent.succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`
