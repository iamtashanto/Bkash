# Release checklist

Release ladder: `0.1.0-alpha.2` → `0.1.0-beta.1` → `0.1.0-rc.1` → stable. Publishing happens only through
`.github/workflows/release.yml` (manual, protected `npm-publish` environment, npm provenance). The `latest` dist-tag
is moved to a version only when every **stable gate** below is checked.

## Automated gates (state on 2026-10-27, local runs; CI links to be added after the next push)

| Gate | State | Evidence |
| --- | --- | --- |
| Typecheck, unit and regression tests | Pass locally | bkash-server 83 tests, bkash-client 17 tests, Node 18, 22, 24 |
| v2 adapter matches the documented API | Pass (mock) | `test/regression/v2-conformance.test.ts` |
| Error table equals the published table | Pass | `test/regression/error-table.test.ts` |
| Website samples import real exports | Pass | `test/regression/website-snippets.test.ts` |
| publint and attw (all subpaths) | Pass locally | run on the packed tarball |
| Docs: build, HTML validation, links | Pass locally | `pnpm check:website` |
| Status tables generated from `status.json` | Pass | `node website/scripts/gen-status.mjs --check` |
| CI matrix green on `main` (Node 18/20/22, real Redis) | Pending | run after push |
| Quickstarts executed in CI | Pending | planned |

## Stable gates (all required before `latest`)

| Gate | State |
| --- | --- |
| Live sandbox, v1.2.0-beta: grant, create, query | Done 2026-10-27 (automated, public sandbox credentials) |
| Live sandbox, v1.2.0-beta: full payment with customer PIN and OTP, plus cancel and insufficient-balance cases | **Owner to run** |
| Live sandbox, v2 (needs v2 credentials): full payment, refund, agreement flow | **Owner to run** |
| Real bKash IPN notification verified | **Owner to run** (webhook stays experimental until then) |
| Real-device Android and iOS smoke test of `BkashCheckout` | **Owner to run** |
| Accessibility pass (TalkBack and VoiceOver notes) | Open |
| Independent review of payment, token and webhook code | Open |
| Shadow-mode or pilot results from a real merchant | Open |
| Zero open BLOCKER or HIGH findings | Open (see `docs/internal/TRIAGE.md`) |
| npm trusted publishing configured, 2FA on | Owner to configure |
| Bangla copy reviewed by a native speaker | Open |

Without all stable gates the website and READMEs keep the pre-release banner and the package stays on a pre-release tag.

## Support policy (after stable)

- **Supported versions:** the latest minor release receives fixes; the previous minor receives security fixes for 90 days.
- **Security contact:** GitHub private vulnerability reporting on this repository. Acknowledgement within 3 business days.
- **Deprecation:** a deprecated API stays for at least one minor release with a documented replacement and a runtime warning.
- **bKash API changes:** the SDK follows the published bKash documentation; when bKash changes an endpoint, a patch release follows once the change is confirmed.
