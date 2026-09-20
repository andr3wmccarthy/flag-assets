import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.resolve(
  process.argv[2] ??
    path.join(root, "../../.local/supabase/imports/flag-squares"),
);
const widths = [48, 96, 144, 200, 400, 600];
const defaultWidth = 400;
const quality = 85;
const { version } = JSON.parse(
  await fs.readFile(path.join(root, "package.json"), "utf8"),
);
const output = path.join(root, "assets", version);
const jobs = JSON.parse(
  await fs.readFile(path.join(source, "queue.json"), "utf8"),
);
const hash = (data) => createHash("sha256").update(data).digest("hex");

// Validate the whole source before writing a release. Local import receipts pin the originals.
for (const job of jobs) {
  const receipt = JSON.parse(
    await fs.readFile(path.join(source, "imported", `${job.key}.json`), "utf8"),
  );
  const data = await fs.readFile(
    path.join(source, "generated", `${job.key}.png`),
  );
  if (
    receipt.id !== job.id ||
    receipt.status !== "ready" ||
    receipt.sha256 !== hash(data)
  ) {
    throw new Error(`Source does not match the imported artwork: ${job.id}`);
  }
}

await fs.mkdir(path.dirname(output), { recursive: true });
// A release is never overwritten. Bump package.json for a deliberate new release.
await fs.mkdir(output);
const flags = [];
const urls = {};
for (const job of jobs.toSorted((a, b) => a.id.localeCompare(b.id, "en"))) {
  const original = await fs.readFile(
    path.join(source, "generated", `${job.key}.png`),
  );
  const receipt = JSON.parse(
    await fs.readFile(path.join(source, "receipts", `${job.key}.json`), "utf8"),
  );
  const metadata = await sharp(original).metadata();
  if (metadata.width !== metadata.height)
    throw new Error(`Non-square source: ${job.id}`);
  const sourceHash = hash(original);
  const directory = `${job.kind}/${job.code.toLowerCase()}.${sourceHash.slice(0, 16)}`;
  await fs.mkdir(path.join(output, directory), { recursive: true });
  const variants = [];
  for (const width of widths) {
    const data = await sharp(original)
      .resize(width, width)
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer();
    const file = `${directory}/${width}.webp`;
    await fs.writeFile(path.join(output, file), data);
    variants.push({
      file,
      width,
      height: width,
      bytes: data.length,
      sha256: hash(data),
    });
  }
  const defaultVariant = variants.find(
    (variant) => variant.width === defaultWidth,
  );
  flags.push({
    id: job.id,
    code: job.code,
    kind: job.kind,
    name: job.name,
    parent: job.parent,
    isoCode: job.iso_code,
    isoStatus: job.iso_status,
    identityNote: job.identity_note,
    designKind: job.design_kind,
    designNote: job.design_note,
    visualReview: receipt.visual_review ?? null,
    sourcePage: job.source_page,
    sourceLicense: job.source_license,
    sourceSha256: sourceHash,
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
    ...defaultVariant,
    variants,
  });
  urls[job.id] = defaultVariant.file;
  if (job.iso_code && job.iso_code !== job.code)
    urls[`${job.kind}:${job.iso_code}`] = defaultVariant.file;
  if (flags.length % 100 === 0)
    console.log(`Exported ${flags.length}/${jobs.length} flags`);
}
const manifest = {
  version,
  description:
    "Square adaptations and custom geographic artwork. Original designs preserved; web derivatives are resized and encoded as WebP.",
  encoding: {
    widths,
    defaultWidth,
    format: "webp",
    quality,
    smartSubsample: true,
    sharp: sharp.versions.sharp,
  },
  flags,
};
await fs.writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await fs.writeFile(
  path.join(root, "urls.json"),
  JSON.stringify({ version, widths, flags: urls }, null, 2) + "\n",
);
console.log(
  `Released ${flags.length} flags in ${widths.length} sizes, ${(flags.flatMap((f) => f.variants).reduce((sum, f) => sum + f.bytes, 0) / 1024 / 1024).toFixed(1)} MiB, to ${output}`,
);
