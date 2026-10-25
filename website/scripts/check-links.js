/**
 * Base-Path Aware Link & Asset Checker
 * 
 * Validates that all internal hrefs and src attributes in website/dist point to existing files,
 * properly stripping BASE_PATH.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

let rawBasePath = process.env.BASE_PATH || '/Bkash/';
if (!rawBasePath.startsWith('/')) rawBasePath = '/' + rawBasePath;
if (!rawBasePath.endsWith('/')) rawBasePath = rawBasePath + '/';
const BASE_PATH = rawBasePath;

console.log(`\n🔍 Running base-path aware link check...`);
console.log(`   Base Path: ${BASE_PATH}`);
console.log(`   Target Directory: ${distDir}\n`);

if (!fs.existsSync(distDir)) {
  console.error(`❌ dist directory does not exist! Run build first.`);
  process.exit(1);
}

function findHtmlFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

const htmlFiles = findHtmlFiles(distDir);
let errors = 0;
let checkedCount = 0;

for (const filePath of htmlFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativeFile = path.relative(distDir, filePath);
  
  // Match href="..." and src="..."
  const linkRegex = /(?:href|src)=["']([^"']+)["']/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const target = match[1].trim();

    // Skip anchors, mailto, external links, data URIs
    if (
      target.startsWith('#') ||
      target.startsWith('http://') ||
      target.startsWith('https://') ||
      target.startsWith('mailto:') ||
      target.startsWith('data:') ||
      target.startsWith('javascript:')
    ) {
      continue;
    }

    checkedCount++;

    // Internal link: must either match BASE_PATH or be relative
    let relativeTarget = target;
    if (target.startsWith(BASE_PATH)) {
      relativeTarget = target.slice(BASE_PATH.length);
    } else if (target.startsWith('/')) {
      console.warn(`   ⚠️ Warning in ${relativeFile}: Absolute link "${target}" does not use BASE_PATH "${BASE_PATH}"`);
      errors++;
      continue;
    }

    // Strip hash or query params
    relativeTarget = relativeTarget.split('#')[0].split('?')[0];

    // If empty, it refers to root index.html
    if (relativeTarget === '' || relativeTarget === '/') {
      relativeTarget = 'index.html';
    }

    // Check if target file or directory index.html exists
    let resolved = path.join(distDir, relativeTarget);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      resolved = path.join(resolved, 'index.html');
    }

    if (!fs.existsSync(resolved)) {
      console.error(`   ❌ Broken link in ${relativeFile} -> "${target}" (Resolved to: ${resolved})`);
      errors++;
    }
  }
}

console.log(`\n📊 Checked ${checkedCount} internal links across ${htmlFiles.length} HTML files.`);

if (errors > 0) {
  console.error(`\n❌ Link check failed with ${errors} error(s).\n`);
  process.exit(1);
} else {
  console.log(`✅ All internal links and assets successfully verified!\n`);
}
