/**
 * 生成 OpenAPI spec 并写入 frontend/openapi.json
 * 用法: npx tsx tools/dump-openapi.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "../src/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.resolve(__dirname, "../../frontend/openapi.json");

const app = buildApp();
await app.ready();

const spec = app.swagger() as Record<string, unknown> & {
  components?: { schemas?: Record<string, { title?: string; [k: string]: unknown }> };
};

// @fastify/swagger v9 renames addSchema entries to def-0, def-1, ...
// Restore proper names using the title field (which matches the $id we set).
const schemas = spec.components?.schemas ?? {};
const renameMap: Record<string, string> = {};
for (const [key, schema] of Object.entries(schemas)) {
  if (key.startsWith("def-") && schema.title) {
    renameMap[key] = schema.title;
  }
}

if (Object.keys(renameMap).length > 0) {
  let specStr = JSON.stringify(spec, null, 2);
  // Replace $ref paths and schema keys — longest keys first to avoid partial matches
  const sortedKeys = Object.keys(renameMap).sort((a, b) => b.length - a.length);
  for (const oldKey of sortedKeys) {
    const newKey = renameMap[oldKey];
    // Replace $ref values
    specStr = specStr.replaceAll(
      `"#/components/schemas/${oldKey}"`,
      `"#/components/schemas/${newKey}"`,
    );
    // Replace the key itself in components/schemas (surrounded by quotes + colon)
    specStr = specStr.replaceAll(`"${oldKey}":`, `"${newKey}":`);
  }
  fs.writeFileSync(OUTPUT, specStr, "utf-8");
} else {
  fs.writeFileSync(OUTPUT, JSON.stringify(spec, null, 2), "utf-8");
}

console.log(`✓ OpenAPI spec written to ${OUTPUT}`);
await app.close();
