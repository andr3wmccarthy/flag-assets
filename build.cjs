const { createHash } = require("node:crypto");
const { cpSync, mkdirSync, readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");
const { FLAG_ASSET_VERSION } = require("./index.cjs");

/** Keeps every bundled release available at its immutable URL. No network or DB access. */
function copyFlagAssets(publicDirectory) {
  const releases = path.join(__dirname, "assets");
  for (const entry of readdirSync(releases, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const source = path.join(releases, entry.name);
    const manifest = JSON.parse(
      readFileSync(path.join(source, "manifest.json"), "utf8"),
    );
    if (manifest.version !== entry.name)
      throw new Error(`Flag release version mismatch: ${entry.name}`);
    for (const flag of manifest.flags) {
      for (const variant of flag.variants) {
        const data = readFileSync(path.join(source, variant.file));
        if (
          createHash("sha256").update(data).digest("hex") !== variant.sha256
        ) {
          throw new Error(
            `Flag asset checksum mismatch: ${flag.id} at ${variant.width}px`,
          );
        }
      }
    }
    const target = path.resolve(publicDirectory, "flags", entry.name);
    mkdirSync(target, { recursive: true });
    cpSync(source, target, { recursive: true });
  }
  return path.resolve(publicDirectory, "flags", FLAG_ASSET_VERSION);
}

exports.copyFlagAssets = copyFlagAssets;
