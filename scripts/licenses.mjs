import fs from "node:fs/promises";
import path from "node:path";
const destination = path.resolve(import.meta.dirname, "../assets/licenses");
await fs.mkdir(destination, { recursive: true });
await Promise.all(
  ["Galada", "Inter", "Manrope"].map(async (name) => {
    const response = await fetch(
      `https://raw.githubusercontent.com/google/fonts/main/ofl/${name.toLowerCase()}/OFL.txt`,
    );
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    await fs.writeFile(
      path.join(destination, `${name}-OFL.txt`),
      await response.text(),
    );
    console.log(`${name}: OFL saved`);
  }),
);
