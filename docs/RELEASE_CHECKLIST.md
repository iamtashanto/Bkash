# Release Go / No-Go Checklist

**Target Release:** `0.1.0-alpha.1` (Dist-Tag: `alpha`)  
**Package:** `bkash-server`, `bkash-client`  
**License:** MIT  

---

## 1. Quality & Compatibility Matrix

| Category | Verification Item | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- |
| **Packaging** | `publint` lint checks | **PASS 🟢** | Verified clean on `bkash-server` and `bkash-client`. |
| **Types** | `@arethetypeswrong/cli` (attw) | **PASS 🟢** | All resolution modes (`node10`, `node16-cjs`, `node16-esm`, `bundler`) 100% green. |
| **Resolution** | TypeScript `moduleResolution` | **PASS 🟢** | Verified under `node10`, `node16`, `nodenext`, `bundler` with `strict: true`. |
| **Tarball** | `npm pack --dry-run` | **PASS 🟢** | Clean whitelist (`dist`, `README.md`, `LICENSE`). No tests/source leaks. |
| **Secret Scan** | Gitleaks repository scan | **PASS 🟢** | `gitleaks dir -v .` scanned 1.01 MB $\rightarrow$ 0 leaks found. |
| **Tests** | Vitest Test Suite | **PASS 🟢** | 45 tests passing across 14 test files (12 server, 2 client). |
| **Runtimes** | Node.js (18, 20, 22), Bun, Deno | **PASS 🟢** | Tested via direct execution in Node, Bun, and Deno (`--allow-env`). |
| **Package Managers** | npm, pnpm, yarn classic, bun | **PASS 🟢** | Tarball installation & import verified in clean consumer project. |
| **Version Gate** | Tokenized v2 Adapter | **EXPERIMENTAL** | Mapped and contract tested; experimental pending sandbox credentials. |

---

## 2. Security & Policy Verification

- [x] **No Real Credentials:** Zero real keys, passwords, phone numbers, or merchant IDs in repo.
- [x] **Client Sanitization:** No client project names or internal audit details in tracked files.
- [x] **Internal Audit Isolated:** `docs/internal/` is gitignored.
- [x] **Gitleaks Pre-commit Hook:** Installed and verified executable.
- [x] **CI Pipeline:** `.github/workflows/ci.yml` configured with pinned SHAs.
- [x] **Branch Protection:** Ready for pull request enforcement on `main`.

---

## 3. Go / No-Go Decision

* **Automated Quality Checks:** **GO 🟢**
* **Publish Approval:** **PENDING USER AUTHORIZATION**
  - Package will NOT be published until user gives explicit command.
  - Initial publication will target `@alpha` tag (`0.1.0-alpha.1`), never `latest`.
