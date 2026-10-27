import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const page = readFileSync(
  fileURLToPath(
    new URL("../../../../website/src/pages/index.html", import.meta.url),
  ),
  "utf8",
)
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&");

const entries: Record<string, () => Promise<Record<string, unknown>>> = {
  "bkash-server": () => import("../../src/index.js"),
  "bkash-server/frameworks": () => import("../../src/frameworks.js"),
  "bkash-server/webhook": () => import("../../src/webhook.js"),
  "bkash-server/redis": () => import("../../src/redis.js"),
};

describe("website code samples only import names that exist", () => {
  const imports = [
    ...page.matchAll(/import\s*\{([^}]+)\}\s*from\s*"(bkash-server[^"]*)"/g),
  ];

  it("finds server imports on the page", () => {
    expect(imports.length).toBeGreaterThan(0);
  });

  for (const [, names, spec] of imports) {
    it(`${spec}: ${names.trim()}`, async () => {
      expect(entries[spec], `unknown entrypoint ${spec}`).toBeDefined();
      const mod = await entries[spec]();
      for (const name of names
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)) {
        expect(
          Object.keys(mod),
          `${name} is not exported by ${spec}`,
        ).toContain(name);
      }
    });
  }
});
