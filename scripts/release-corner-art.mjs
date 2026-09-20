import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const version = "1.1.0";
const previousVersion = "1.0.0";
const source = path.join(root, "masters", version);
const previous = path.join(root, "assets", previousVersion);
const output = path.join(root, "assets", version);
const { flags: edits } = JSON.parse(
  await fs.readFile(path.join(source, "prompts.json"), "utf8"),
);
const manifest = JSON.parse(
  await fs.readFile(path.join(previous, "manifest.json"), "utf8"),
);
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const expectedCodes = manifest.flags
  .filter((flag) => flag.kind === "subdivision" && flag.parent === "CN")
  .map((flag) => flag.code)
  .sort();
if (
  JSON.stringify(edits.map((edit) => edit.code).sort()) !==
  JSON.stringify(expectedCodes)
) {
  throw new Error(
    "Corner artwork must cover exactly the 31 existing Chinese subdivisions",
  );
}

// Validate every master before starting a release, retaining the frozen previous release.
for (const edit of edits) {
  const info = await sharp(path.join(source, edit.file)).metadata();
  if (
    info.format !== "png" ||
    info.width !== info.height ||
    info.width < 1000
  ) {
    throw new Error(`Expected a full-size square PNG: ${edit.code}`);
  }
}
await fs.mkdir(output);
await fs.cp(previous, output, { recursive: true });
const { widths, quality, smartSubsample, defaultWidth } = manifest.encoding;
for (const edit of edits) {
  const flag = manifest.flags.find(
    (flag) => flag.id === `subdivision:${edit.code}`,
  );
  const data = await fs.readFile(path.join(source, edit.file));
  const info = await sharp(data).metadata();
  const digest = sha256(data);
  const directory = `subdivision/${edit.code.toLowerCase()}.${digest.slice(0, 16)}`;
  await fs.mkdir(path.join(output, directory));
  // Only remove the superseded copy in the new release; 1.0.0 stays untouched.
  await fs.rm(path.join(output, path.dirname(flag.file)), { recursive: true });
  const variants = [];
  for (const width of widths) {
    const image = await sharp(data)
      .resize(width, width)
      .webp({ quality, effort: 6, smartSubsample })
      .toBuffer();
    const file = `${directory}/${width}.webp`;
    await fs.writeFile(path.join(output, file), image);
    variants.push({
      file,
      width,
      height: width,
      bytes: image.length,
      sha256: sha256(image),
    });
  }
  const originalSourceSha256 = flag.sourceSha256;
  Object.assign(
    flag,
    variants.find((variant) => variant.width === defaultWidth),
    {
      designKind: "custom",
      designNote: `Custom yellow lower-right symbol: ${edit.symbol}. Cultural identifier for the personal map, not an official provincial emblem.`,
      visualReview:
        "Yellow corner symbol reviewed against the requested subject; red field and five-star design retained.",
      originalSourceSha256,
      sourceSha256: digest,
      sourceWidth: info.width,
      sourceHeight: info.height,
      artworkRevision: {
        generator: "Built-in ImageGen",
        symbol: edit.symbol,
        corner: "lower-right",
        originalVersion: previousVersion,
      },
      variants,
    },
  );
}
manifest.version = version;
manifest.description =
  "Square geographic artwork; 31 Chinese subdivisions include custom yellow cultural symbols in the lower-right corner.";
await fs.writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
const urls = {};
for (const flag of manifest.flags) {
  urls[flag.id] = flag.file;
  if (flag.isoCode && flag.isoCode !== flag.code)
    urls[`${flag.kind}:${flag.isoCode}`] = flag.file;
}
await fs.writeFile(
  path.join(root, "urls.json"),
  JSON.stringify({ version, widths, flags: urls }, null, 2) + "\n",
);
console.log(
  `Released ${edits.length} corner edits in ${version}; preserved ${manifest.flags.length - edits.length} other designs and all of ${previousVersion}.`,
);
