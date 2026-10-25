# bKash SDK Documentation & Marketing Website

This directory contains the source code, design system, build scripts, and deployment pipeline for the official documentation and marketing website for `bkash-server` and `bkash-client`.

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
From the repository root (or inside `/website`):
```bash
pnpm install
```

### 2. Run Local Development Server
To watch both Tailwind CSS and static HTML changes:
```bash
# Terminal 1: Watch Tailwind CSS
pnpm --filter bkash-website dev:css

# Terminal 2: Watch Site Generator & Partials
pnpm --filter bkash-website dev:site
```

To serve the generated `dist/` directory locally:
```bash
npx serve website/dist
```

---

## ⚙️ Environment Variables

The static build script (`scripts/build.js`) and link checker (`scripts/check-links.js`) read the following environment variables:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `SITE_URL` | `https://iamtashanto.github.io` | Origin domain for canonical links and Open Graph tags. |
| `BASE_PATH` | `/Bkash/` | URL subpath prefix. For GitHub project pages, this is `/<repo-name>/`. For custom root domains, set to `/`. |
| `SITE_INDEXABLE` | `false` | When `false`, adds `<meta name="robots" content="noindex, nofollow">` and `Disallow: /` in `robots.txt`. Set to `true` upon public launch. |

---

## 🌐 One-Time GitHub Pages Setup

To enable automated deployment via GitHub Actions:

1. Navigate to your repository on GitHub: `https://github.com/iamtashanto/Bkash/settings/pages`.
2. Under **Build and deployment > Source**, select **GitHub Actions** (instead of "Deploy from a branch").
3. Ensure the `github-pages` environment is created (created automatically upon first workflow dispatch or push to `main`).

---

## 🏷️ How to Add a Custom Domain

When mapping a custom domain (e.g. `bkash.dev` or `docs.yourdomain.com`):

1. Add a `CNAME` file to `website/dist/` (or configure via GitHub Pages Settings):
   ```bash
   echo "docs.yourdomain.com" > website/src/assets/CNAME
   ```
2. Update environment variables in GitHub Actions workflow:
   - Set `BASE_PATH=/`
   - Set `SITE_URL=https://docs.yourdomain.com`
3. The build script automatically resolves all assets, stylesheets, scripts, and internal hyperlinks to root `/` without code modifications.

---

## 🔍 How to Flip Search Indexability (`SITE_INDEXABLE`) at Launch

During pre-release / alpha development, `SITE_INDEXABLE` is set to `false` to prevent search engines from indexing incomplete API documentation:
* Generates `<meta name="robots" content="noindex, nofollow">`
* Generates `Disallow: /` in `robots.txt`

**When ready for public SEO launch:**
1. In `.github/workflows/pages.yml`, update:
   ```yaml
   SITE_INDEXABLE: 'true'
   ```
2. Re-deploy. The build script will automatically generate:
   * `<meta name="robots" content="index, follow">`
   * `Allow: /` and sitemap link in `robots.txt`
   * Complete `sitemap.xml` with priority `1.0`

---

## 🧪 Local Quality & Validation Suite

Before committing or opening a PR, run the automated validation suite:

```bash
# 1. Full Production Build (Tailwind minified + HTML rendered)
pnpm --filter bkash-website build

# 2. Strict HTML5 Validation
pnpm --filter bkash-website check:html

# 3. Base-Path Aware Link & Asset Checker
pnpm --filter bkash-website check:links

# 4. Code Formatting Verification
pnpm --filter bkash-website check:format

# 5. Auto-Format Files with Prettier
pnpm --filter bkash-website format
```
