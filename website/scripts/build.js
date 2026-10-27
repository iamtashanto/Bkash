/**
 * Static Site Builder for bkash-server & bkash-client Website
 *
 * Injects partials, resolves BASE_PATH and SITE_URL, generates sitemap.xml, robots.txt, .nojekyll,
 * and sets up folder-style clean URLs.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Environment Variables
const rawSiteUrl = process.env.SITE_URL || "https://iamtashanto.github.io";
const SITE_URL = rawSiteUrl.replace(/\/+$/, "");

let rawBasePath = process.env.BASE_PATH || "/Bkash/";
if (!rawBasePath.startsWith("/")) rawBasePath = "/" + rawBasePath;
if (!rawBasePath.endsWith("/")) rawBasePath = rawBasePath + "/";
const BASE_PATH = rawBasePath;

const SITE_INDEXABLE = process.env.SITE_INDEXABLE === "true";

const srcDir = path.join(rootDir, "src");
const distDir = path.join(rootDir, "dist");
const pagesDir = path.join(srcDir, "pages");
const partialsDir = path.join(srcDir, "partials");
const docsDir = path.join(rootDir, "docs");
const statusData = JSON.parse(
  fs.readFileSync(path.join(srcDir, "data", "status.json"), "utf8"),
);
const errorCodes = JSON.parse(
  fs.readFileSync(path.join(srcDir, "data", "error-codes.json"), "utf8"),
);

console.log(`\n🔨 Building website...`);
console.log(`   SITE_URL:       ${SITE_URL}`);
console.log(`   BASE_PATH:      ${BASE_PATH}`);
console.log(`   SITE_INDEXABLE: ${SITE_INDEXABLE}\n`);

// Ensure dist directory exists
fs.mkdirSync(distDir, { recursive: true });

// Load partials
function loadPartials() {
  const partials = {};
  const files = fs.readdirSync(partialsDir);
  for (const file of files) {
    if (file.endsWith(".html")) {
      const name = path.basename(file, ".html");
      partials[name] = fs.readFileSync(path.join(partialsDir, file), "utf8");
    }
  }
  return partials;
}

const partials = loadPartials();

// Template replacement engine
function renderTemplate(content, metadata = {}) {
  let result = content;

  // Replace partials: {{> partialName}}
  result = result.replace(/\{\{>\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, name) => {
    return partials[name] || `<!-- Missing partial: ${name} -->`;
  });

  // Second pass for any nested partial references
  result = result.replace(/\{\{>\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, name) => {
    return partials[name] || `<!-- Missing partial: ${name} -->`;
  });

  const robotsMeta = SITE_INDEXABLE
    ? '<meta name="robots" content="index, follow">'
    : '<meta name="robots" content="noindex, nofollow">';

  const defaults = {
    SITE_URL,
    BASE_PATH,
    ROBOTS_META: robotsMeta,
    STATUS_ROWS: statusRows(),
    PAGE_TITLE: metadata.title || "bKash SDK for JavaScript & TypeScript",
    PAGE_DESCRIPTION:
      metadata.description ||
      "Production-hardened, zero-dependency bKash payment SDK with token caching and multi-framework client bindings.",
    PAGE_CANONICAL: `${SITE_URL}${BASE_PATH}${metadata.path ? metadata.path.replace(/^\/+/, "") : ""}`,
  };

  const merged = { ...defaults, ...metadata };

  for (const [key, val] of Object.entries(merged)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, val);
  }

  return result;
}

// Copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Generated content (single source of truth: src/data/*.json)
// ---------------------------------------------------------------------------
const escapeHtml = (v) =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const STATUS_STYLES = {
  stable:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  beta: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  experimental:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  planned:
    "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

function statusRows() {
  return statusData.features
    .map(
      (f) => `                  <tr>
                    <td class="py-3.5 px-4 sm:px-6 font-semibold text-txt-primary">${escapeHtml(f.name)}</td>
                    <td class="py-3.5 px-4 sm:px-6">${escapeHtml(f.category)}</td>
                    <td class="py-3.5 px-4 sm:px-6"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[f.status]}">${escapeHtml(f.status)}</span></td>
                    <td class="py-3.5 px-4 sm:px-6 text-txt-muted text-xs">${escapeHtml(f.description)}<br /><span class="opacity-80">Evidence: ${escapeHtml(f.evidence)}</span></td>
                  </tr>`,
    )
    .join("\n");
}

function statusTableHtml() {
  return `<div class="overflow-x-auto"><table><thead><tr><th>Feature</th><th>Package</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${statusData.features
    .map(
      (f) =>
        `<tr><td>${escapeHtml(f.name)}</td><td><code>${escapeHtml(f.package)}</code></td><td><span class="status-pill status-${f.status}">${escapeHtml(f.status)}</span></td><td>${escapeHtml(f.evidence)}</td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function errorTableHtml() {
  return `<div class="overflow-x-auto"><table><thead><tr><th>Code</th><th>Meaning (bKash)</th></tr></thead><tbody>${Object.entries(
    errorCodes,
  )
    .map(
      ([code, msg]) =>
        `<tr id="e${code}"><td><code>${code}</code></td><td>${escapeHtml(msg)}</td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}

// ---------------------------------------------------------------------------
// Documentation (Markdown in website/docs -> dist/docs/<slug>/index.html)
// ---------------------------------------------------------------------------
function parseFrontMatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return { data, body: raw.slice(m[0].length) };
}

const slugify = (t) => {
  const slug = t
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return /^[a-z]/.test(slug) ? slug : `s-${slug}`;
};

function renderMarkdown(body) {
  const toc = [];
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const id = slugify(text);
    if (depth === 2 || depth === 3)
      toc.push({ depth, id, text: text.replace(/<[^>]+>/g, "") });
    return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${text}</h${depth}>\n`;
  };
  const baseTable = renderer.table.bind(renderer);
  renderer.table = function (token) {
    return `<div class="overflow-x-auto">${baseTable(token)}</div>`;
  };
  renderer.code = function ({ text, lang }) {
    const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
    return `<pre class="code-block"><code${cls}>${escapeHtml(text)}</code></pre>\n`;
  };
  const expanded = body
    .replace("{{STATUS_TABLE}}", "@@STATUS_TABLE@@")
    .replace("{{ERROR_TABLE}}", "@@ERROR_TABLE@@");
  let html = marked.parse(expanded, { renderer, gfm: true });
  html = html
    .replace(/disabled=""/g, "disabled")
    .replace(/href="\.\.\/([a-z-]+)\//g, 'href="{{BASE_PATH}}docs/$1/')
    .replace(/<p>@@STATUS_TABLE@@<\/p>|@@STATUS_TABLE@@/, statusTableHtml())
    .replace(/<p>@@ERROR_TABLE@@<\/p>|@@ERROR_TABLE@@/, errorTableHtml());
  return { html, toc };
}

function loadDocs() {
  if (!fs.existsSync(docsDir)) return [];
  return fs
    .readdirSync(docsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data, body } = parseFrontMatter(
        fs.readFileSync(path.join(docsDir, f), "utf8"),
      );
      return {
        slug: path.basename(f, ".md"),
        order: Number(data.order ?? 99),
        title: data.title || f,
        description: data.description || "",
        section: data.section || "Guides",
        body,
      };
    })
    .sort((a, b) => a.order - b.order);
}

function docsLayout(doc, docs, rendered) {
  const sections = [...new Set(docs.map((d) => d.section))];
  const nav = sections
    .map(
      (sec) =>
        `<div class="mb-5"><p class="text-xs font-semibold uppercase tracking-wide text-txt-muted mb-2">${escapeHtml(sec)}</p><ul class="space-y-1">${docs
          .filter((d) => d.section === sec)
          .map(
            (d) =>
              `<li><a href="{{BASE_PATH}}docs/${d.slug === "index" ? "" : d.slug + "/"}" class="block px-2 py-1 rounded-md text-sm ${d.slug === doc.slug ? "bg-accent-subtle text-accent-primary font-semibold" : "text-txt-secondary hover:text-txt-primary hover:bg-surface-elevated"}"${d.slug === doc.slug ? ' aria-current="page"' : ""}>${escapeHtml(d.title)}</a></li>`,
          )
          .join("")}</ul></div>`,
    )
    .join("");
  const toc = rendered.toc.length
    ? `<nav aria-label="On this page" class="hidden xl:block w-56 shrink-0"><div class="sticky top-24 text-sm"><p class="text-xs font-semibold uppercase tracking-wide text-txt-muted mb-2">On this page</p><ul class="space-y-1">${rendered.toc
        .map(
          (t) =>
            `<li class="${t.depth === 3 ? "pl-3" : ""}"><a class="text-txt-secondary hover:text-txt-primary" href="#${t.id}">${t.text}</a></li>`,
        )
        .join("")}</ul></div></nav>`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    {{> head}}
    <link rel="stylesheet" href="{{BASE_PATH}}css/docs.css" />
  </head>
  <body class="min-h-screen flex flex-col bg-surface-base text-txt-primary">
    {{> navbar}}
    <div class="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-8">
      <aside class="hidden lg:block w-60 shrink-0" aria-label="Documentation"><div class="sticky top-24">${nav}</div></aside>
      <main id="main-content" class="min-w-0 flex-1">
        <details class="lg:hidden mb-6 rounded-lg border border-border-subtle p-3"><summary class="cursor-pointer text-sm font-semibold">Documentation menu</summary><div class="mt-3">${nav}</div></details>
        <article class="docs-prose">${rendered.html}</article>
        <p class="mt-10 text-xs text-txt-muted">Found a mistake? <a class="underline" href="https://github.com/iamtashanto/Bkash/edit/main/website/docs/${doc.slug}.md">Edit this page on GitHub</a>. Unofficial community project, not affiliated with bKash Limited.</p>
      </main>
      ${toc}
    </div>
    {{> footer}}
    <script type="module" src="{{BASE_PATH}}js/main.js"></script>
  </body>
</html>`;
}

function buildDocs() {
  const docs = loadDocs();
  for (const doc of docs) {
    const rendered = renderMarkdown(doc.body);
    const page = renderTemplate(docsLayout(doc, docs, rendered), {
      title: doc.title,
      description: doc.description,
      path: doc.slug === "index" ? "docs/" : `docs/${doc.slug}/`,
    });
    const out = path.join(
      distDir,
      "docs",
      doc.slug === "index" ? "" : doc.slug,
      "index.html",
    );
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, page, "utf8");
  }
  console.log(`   ✓ Rendered: ${docs.length} documentation pages`);
  return docs;
}

// Process Pages
function buildPages() {
  const pageFiles = [
    {
      file: "index.html",
      dest: "index.html",
      meta: {
        title: "bKash SDK — Modern, Type-Safe Payments for JS/TS",
        description:
          "Unofficial, production-hardened bKash payment SDK with proactive token caching, idempotency guards, and React/React Native bindings.",
        path: "",
      },
    },
    {
      file: "404.html",
      dest: "404.html",
      meta: {
        title: "404 Not Found",
        description: "Page not found.",
        path: "404.html",
      },
    },
  ];

  for (const page of pageFiles) {
    const srcPath = path.join(pagesDir, page.file);
    if (fs.existsSync(srcPath)) {
      const content = fs.readFileSync(srcPath, "utf8");
      const rendered = renderTemplate(content, page.meta);
      const destPath = path.join(distDir, page.dest);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, rendered, "utf8");
      console.log(`   ✓ Rendered: ${page.dest}`);
    }
  }
}

// Generate robots.txt
function generateRobots() {
  let content = "";
  if (SITE_INDEXABLE) {
    content = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}${BASE_PATH}sitemap.xml\n`;
  } else {
    content = `User-agent: *\nDisallow: /\n`;
  }
  fs.writeFileSync(path.join(distDir, "robots.txt"), content, "utf8");
  console.log(`   ✓ Generated: robots.txt (Disallow: ${!SITE_INDEXABLE})`);
}

// Generate sitemap.xml
function generateSitemap(docs = []) {
  const today = new Date().toISOString().split("T")[0];
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}${BASE_PATH}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${docs.map((d) => `  <url>\n    <loc>${SITE_URL}${BASE_PATH}docs/${d.slug === "index" ? "" : d.slug + "/"}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`).join("\n")}
</urlset>\n`;
  fs.writeFileSync(path.join(distDir, "sitemap.xml"), content, "utf8");
  console.log(`   ✓ Generated: sitemap.xml`);
}

// Create .nojekyll for GitHub Pages
function createNoJekyll() {
  fs.writeFileSync(path.join(distDir, ".nojekyll"), "", "utf8");
  console.log(`   ✓ Created: .nojekyll`);
}

// Copy static JS and Assets
function copyAssets() {
  copyDir(path.join(srcDir, "js"), path.join(distDir, "js"));
  console.log(`   ✓ Copied: JS modules`);

  fs.mkdirSync(path.join(distDir, "css"), { recursive: true });
  fs.copyFileSync(
    path.join(srcDir, "styles", "docs.css"),
    path.join(distDir, "css", "docs.css"),
  );
  copyDir(path.join(srcDir, "assets"), path.join(distDir, "assets"));
  console.log(`   ✓ Copied: Static assets`);
}

// Main execution
function buildAll() {
  buildPages();
  const docs = buildDocs();
  generateRobots();
  generateSitemap(docs);
  createNoJekyll();
  copyAssets();
  console.log(`\n✨ Site build completed successfully in website/dist!\n`);
}

buildAll();

if (process.argv.includes("--watch")) {
  console.log(`👀 Watching website/src for changes...`);
  fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (
      filename &&
      (filename.endsWith(".html") ||
        filename.endsWith(".js") ||
        filename.endsWith(".json"))
    ) {
      console.log(`🔄 Change detected in ${filename}, rebuilding...`);
      try {
        buildAll();
      } catch (err) {
        console.error("Error during rebuild:", err);
      }
    }
  });
}
