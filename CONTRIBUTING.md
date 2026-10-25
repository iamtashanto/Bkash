# Contributing to bKash SDK

Thank you for your interest in contributing to `bkash-server` and `bkash-client`!

---

## Development Setup

1. **Prerequisites:** Node.js >= 18, `pnpm` >= 9.
2. **Clone & Install:**
   ```bash
   git clone https://github.com/iamtashanto/Bkash.git
   cd Bkash
   pnpm install
   ```
3. **Run Tests:**
   ```bash
   pnpm run test
   ```
4. **Typecheck & Build:**
   ```bash
   pnpm run typecheck
   pnpm run build
   ```

---

## Branching & Pull Requests

- Create a feature branch from `main`: `git checkout -b feat/your-feature`.
- Keep commits focused and descriptive following Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`).
- Run `gitleaks dir -v .` before committing.
- Ensure all tests and typechecks pass before submitting a pull request.

---

## Code of Conduct

This project is open-source and welcoming to everyone. Please be respectful, inclusive, and collaborative.
