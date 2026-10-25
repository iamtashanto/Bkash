# Security Policy & Threat Model Specification

**Project:** `bkash-server` & `bkash-client`  
**Security Level:** High (Financial Payment Processing)  
**Version:** 1.0.0  

---

## 1. Threat Model & Mitigations

| Threat Vector | Risk Description | SDK Mitigation |
| :--- | :--- | :--- |
| **1. Callback Tampering** | An attacker alters the browser redirect query parameters (`?status=success&paymentID=...`) to falsify payment completion. | **Zero Trust:** Callback parameters are NEVER trusted to mark an order paid. The server calls bKash's `/execute` endpoint and confirms `transactionStatus === "Completed"`. |
| **2. Amount & Invoice Tampering** | An attacker initiates checkout for 1 BDT and attempts to complete an order worth 1,550 BDT. | **Financial Verification Guard:** The SDK strictly checks `result.amount === expectedOrder.amount`, `result.currency === 'BDT'`, and `result.invoiceNumber === expectedOrder.invoiceNumber`. Any discrepancy throws a hard `BkashVerificationMismatchError`. |
| **3. Webhook Spoofing & Replay** | An attacker crafts a forged HTTP POST to `/webhook` or replays a captured payment event. | **Cryptographic RSA Verification:** Every AWS SNS message signature is verified using the official bKash X.509 certificate. Replays are thwarted via the `MessageId` replay store and a configurable timestamp freshness window. |
| **4. SSRF via SigningCertURL** | An attacker sends a forged SNS payload pointing `SigningCertURL` to an internal intranet host (e.g. `http://169.254.169.254`). | **Strict URL Constraint:** The SDK enforces `https:` protocol, rejects non-standard ports and credentials, and matches the host against `^sns\.[a-z0-9-]+\.amazonaws\.com$` and path with `.pem`. |
| **5. Credential & PII Leakage** | Customer mobile numbers or bKash API credentials leak into application logs or telemetry. | **Sanitization Layer:** All customer phone numbers are automatically masked (`017****5678`), and credentials (`appSecret`, `password`, `idToken`) are redacted before logging. |
| **6. Token Lockout DoS** | Concurrent requests or multi-instance deployments trigger bKash's strict **2 calls / hour** token limit, locking credentials for 1 hour. | **Proactive Distributed Mutex:** Single-flight Promise deduplication, Redis atomic lease (`SET NX PX` with compare-and-delete Lua release), and proactive 50-minute rotation. |

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability within `bkash-server` or `bkash-client`, please report it responsibly:

* **Email:** `security@antigravity.dev` (or open a Private Vulnerability Advisory on GitHub).
* **Response Time:** Initial acknowledgment within 24 hours; patch and advisory within 72 hours.
* **Please DO NOT** open public GitHub issues for undisclosed security vulnerabilities.

---

## 3. Supply Chain Security & Integrity

- **Automated Secret Scanning:** Gitleaks runs in CI and on git pre-commit to prevent secrets from entering history.
- **Dependency Auditing:** `pnpm audit` and Dependabot are enabled.
- **Pinned Actions:** All GitHub Actions workflows pin external actions by immutable commit SHAs.
- **Provenance:** Published packages include cryptographic npm provenance generated via GitHub Actions OIDC.
