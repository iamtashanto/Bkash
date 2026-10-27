/**
 * Generates the feature-status tables from src/data/status.json (the single source of truth)
 * and writes them between <!-- status:start --> and <!-- status:end --> markers.
 *
 *   node scripts/gen-status.mjs          rewrite README files
 *   node scripts/gen-status.mjs --check  fail if any file is out of date
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const status = JSON.parse(
  fs.readFileSync(path.join(root, "website/src/data/status.json"), "utf8"),
);

const label = {
  stable: "Stable",
  beta: "Beta",
  experimental: "Experimental",
  planned: "Planned",
};

export function markdownTable(pkg) {
  const rows = status.features.filter((f) => !pkg || f.package === pkg);
  const lines = ["| Feature | Status | Evidence |", "| --- | --- | --- |"];
  for (const f of rows)
    lines.push(`| ${f.name} | ${label[f.status]} | ${f.evidence} |`);
  return lines.join("\n");
}

const targets = [
  ["README.md", null],
  ["packages/bkash-server/README.md", "bkash-server"],
  ["packages/bkash-client/README.md", "bkash-client"],
];

let stale = false;
for (const [file, pkg] of targets) {
  const p = path.join(root, file);
  const src = fs.readFileSync(p, "utf8");
  const re = /<!-- status:start -->[\s\S]*?<!-- status:end -->/;
  if (!re.test(src)) continue;
  const next = src.replace(
    re,
    `<!-- status:start -->\n<!-- Generated from website/src/data/status.json. Do not edit by hand. -->\n${markdownTable(pkg)}\n<!-- status:end -->`,
  );
  if (next !== src) {
    if (process.argv.includes("--check")) {
      console.error(
        `Out of date: ${file}. Run: node website/scripts/gen-status.mjs`,
      );
      stale = true;
    } else {
      fs.writeFileSync(p, next);
      console.log(`Updated ${file}`);
    }
  }
}
if (stale) process.exit(1);
