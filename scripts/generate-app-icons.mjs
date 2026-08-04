import { accessSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = resolve(root, "public");

for (const fileName of [
  "academic-hub-icon-v3-32.png",
  "academic-hub-icon-v3-180.png",
  "academic-hub-icon-v3-192.png",
  "academic-hub-icon-v3-512.png",
]) {
  accessSync(resolve(publicDirectory, fileName));
}

console.log("Academic Hub icon assets verified.");
