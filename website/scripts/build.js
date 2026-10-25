/**
 * Static Site Builder for bkash-server & bkash-client Website
 * 
 * Injects partials, resolves BASE_PATH and SITE_URL, generates sitemap.xml, robots.txt, .nojekyll,
 * and sets up folder-style clean URLs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Environment Variables
const rawSiteUrl = process.env.SITE_URL || 'https://iamtashanto.github.io';
const SITE_URL = rawSiteUrl.replace(/\/+$/, '');

let rawBasePath = process.env.BASE_PATH || '/Bkash/';
if (!rawBasePath.startsWith('/')) rawBasePath = '/' + rawBasePath;
if (!rawBasePath.endsWith('/')) rawBasePath = rawBasePath + '/';
const BASE_PATH = rawBasePath;

const SITE_INDEXABLE = process.env.SITE_INDEXABLE === 'true';

const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const pagesDir = path.join(srcDir, 'pages');
const partialsDir = path.join(srcDir, 'partials');

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
    if (file.endsWith('.html')) {
      const name = path.basename(file, '.html');
      partials[name] = fs.readFileSync(path.join(partialsDir, file), 'utf8');
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
    PAGE_TITLE: metadata.title || 'bKash SDK for JavaScript & TypeScript',
    PAGE_DESCRIPTION:
      metadata.description ||
      'Production-hardened, zero-dependency bKash payment SDK with token caching and multi-framework client bindings.',
    PAGE_CANONICAL: `${SITE_URL}${BASE_PATH}${metadata.path ? metadata.path.replace(/^\/+/, '') : ''}`
  };

  const merged = { ...defaults, ...metadata };

  for (const [key, val] of Object.entries(merged)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
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

// Process Pages
function buildPages() {
  const pageFiles = [
    {
      file: 'index.html',
      dest: 'index.html',
      meta: {
        title: 'bKash SDK — Modern, Type-Safe Payments for JS/TS',
        description: 'Unofficial, production-hardened bKash payment SDK with proactive token caching, idempotency guards, and React/React Native bindings.',
        path: ''
      }
    },
    {
      file: '404.html',
      dest: '404.html',
      meta: {
        title: '404 Not Found',
        description: 'Page not found.',
        path: '404.html'
      }
    }
  ];

  for (const page of pageFiles) {
    const srcPath = path.join(pagesDir, page.file);
    if (fs.existsSync(srcPath)) {
      const content = fs.readFileSync(srcPath, 'utf8');
      const rendered = renderTemplate(content, page.meta);
      const destPath = path.join(distDir, page.dest);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, rendered, 'utf8');
      console.log(`   ✓ Rendered: ${page.dest}`);
    }
  }
}

// Generate robots.txt
function generateRobots() {
  let content = '';
  if (SITE_INDEXABLE) {
    content = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}${BASE_PATH}sitemap.xml\n`;
  } else {
    content = `User-agent: *\nDisallow: /\n`;
  }
  fs.writeFileSync(path.join(distDir, 'robots.txt'), content, 'utf8');
  console.log(`   ✓ Generated: robots.txt (Disallow: ${!SITE_INDEXABLE})`);
}

// Generate sitemap.xml
function generateSitemap() {
  const today = new Date().toISOString().split('T')[0];
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}${BASE_PATH}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>\n`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), content, 'utf8');
  console.log(`   ✓ Generated: sitemap.xml`);
}

// Create .nojekyll for GitHub Pages
function createNoJekyll() {
  fs.writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf8');
  console.log(`   ✓ Created: .nojekyll`);
}

// Copy static JS and Assets
function copyAssets() {
  copyDir(path.join(srcDir, 'js'), path.join(distDir, 'js'));
  console.log(`   ✓ Copied: JS modules`);

  copyDir(path.join(srcDir, 'assets'), path.join(distDir, 'assets'));
  console.log(`   ✓ Copied: Static assets`);
}

// Main execution
function buildAll() {
  buildPages();
  generateRobots();
  generateSitemap();
  createNoJekyll();
  copyAssets();
  console.log(`\n✨ Site build completed successfully in website/dist!\n`);
}

buildAll();

if (process.argv.includes('--watch')) {
  console.log(`👀 Watching website/src for changes...`);
  fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (filename && (filename.endsWith('.html') || filename.endsWith('.js') || filename.endsWith('.json'))) {
      console.log(`🔄 Change detected in ${filename}, rebuilding...`);
      try {
        buildAll();
      } catch (err) {
        console.error('Error during rebuild:', err);
      }
    }
  });
}
