import { accessSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = resolve(root, "public");

for (const fileName of ["academic-hub-premium.svg"]) {
  accessSync(resolve(publicDirectory, fileName));
}

console.log("Academic Hub premium identity asset verified.");
