# Production Dogfooding & Rollout Plan

**Objective:** Safely validate `bkash-server` in live production environments without risking order completion or merchant revenues.

---

## 1. Stage 1: Shadow Mode (Zero-Risk Observation)

In Shadow Mode, your legacy payment controller continues to handle 100% of live transactions. `bkash-server` runs concurrently in read-only verification mode.

```typescript
// Example: Shadow Mode Callback Controller
app.get('/api/payment/bkash/callback', async (req, res) => {
  const { paymentID, status } = req.query;

  // 1. Existing legacy payment flow executes as normal
  const legacyResult = await legacyBkashExecute(paymentID);

  // 2. Asynchronously verify with bkash-server in shadow mode
  if (process.env.BKASH_SHADOW_MODE === 'true') {
    bkashServer
      .queryPayment({ paymentId: String(paymentID) })
      .then((sdkResult) => {
        // Compare financial values
        const amountMatch = sdkResult.amount === legacyResult.amount;
        const trxMatch = sdkResult.trxId === legacyResult.trxID;

        if (!amountMatch || !trxMatch) {
          console.warn('[SHADOW MISMATCH DETECTED]', {
            legacy: { amount: legacyResult.amount, trxID: legacyResult.trxID },
            sdk: { amount: sdkResult.amount, trxId: sdkResult.trxId },
          });
        }
      })
      .catch((err) => {
        console.error('[SHADOW SDK ERROR]', err);
      });
  }

  // 3. Complete legacy order processing and redirect user
  return res.redirect(`/order/confirmation?status=${status}`);
});
```

---

## 2. Stage 2: Feature-Flagged Canary Rollout (5% – 20%)

Route a small percentage of checkouts through `bkash-server` using an environment variable or feature flag (e.g. Unleash, LaunchDarkly, or custom cookie/hash):

```typescript
const useNewBkashSdk = isFeatureFlagEnabled('bkash_v1_sdk', req.user);

if (useNewBkashSdk) {
  // Execute via bkash-server with automated error 2062 & timeout reconciliation
  const result = await bkashServer.executePayment({
    paymentId: req.query.paymentID,
    expectedOrder: {
      amount: order.totalAmount,
      currency: 'BDT',
      invoiceNumber: order.invoiceNumber,
    },
  });
  return res.redirect(`/order/confirmation?orderId=${order.id}`);
} else {
  // Legacy execution path
  return legacyExecute(req, res);
}
```

---

## 3. Stage 3: Full Cutover & Deprecation

Once 1,000+ consecutive transactions succeed with 0 reconciliation anomalies:
1. Flip feature flag default to 100%.
2. Retain legacy code in codebase for 14 days.
3. Remove legacy payment controller.

---

## 4. Rollback Plan

If any critical discrepancy occurs during Stage 2:
1. Immediately set `ENABLE_NEW_BKASH_SDK=false` in environment variables.
2. Deploy does NOT require rollback; the feature flag instantly returns traffic to the legacy controller.
3. Inspect debug logs with redacted PII for root cause analysis.
