import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const html = await fs.readFile(path.join(root, "index.html"), "utf8");
const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map((x) => x[1])
  .filter((x) => x.trim());
for (const source of inline) new vm.Script(source, { filename: "index.html" });
const files = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
  .map((x) => x[1])
  .filter((x) => !/^https?:/.test(x));
files.push(
  "assets/models/forest.glb",
  "assets/models/glacier.glb",
  "assets/textures/forest.png",
  "assets/textures/glacier.png",
  "assets/vendor/model-viewer.min.js",
);
for (const name of new Set(files)) await fs.access(path.join(root, name));
for (const name of ["forest", "glacier"]) {
  const buffer = await fs.readFile(
    path.join(root, "assets/models", `${name}.glb`),
  );
  if (
    buffer.readUInt32LE(0) !== 0x46546c67 ||
    buffer.readUInt32LE(8) !== buffer.length
  )
    throw new Error(`Invalid GLB: ${name}`);
}
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]);
if (new Set(ids).size !== ids.length) throw new Error("Duplicate element IDs");
for (const match of html.matchAll(/href="#([^"]+)"/g))
  if (!ids.includes(match[1])) throw new Error(`Missing anchor: ${match[1]}`);
console.log(
  `Passed: JavaScript syntax, ${new Set(files).size} local assets, model headers, unique IDs and anchor targets.`,
);
