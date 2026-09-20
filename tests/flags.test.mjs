import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";

import { copyFlagAssets } from "../build.cjs";
import {
  FLAG_ASSET_BASE_PATH,
  FLAG_ASSET_VERSION,
  getCountryFlagUrl,
  getFlagSrcSet,
  getSubdivisionFlagUrl,
} from "../index.cjs";

const release = fileURLToPath(
  new URL(`../assets/${FLAG_ASSET_VERSION}/`, import.meta.url),
);
const manifestText = await readFile(
  path.join(release, "manifest.json"),
  "utf8",
);
const manifest = JSON.parse(manifestText);
const originalText = await readFile(
  new URL("../assets/1.0.0/manifest.json", import.meta.url),
  "utf8",
);
const original = JSON.parse(originalText);

test("version 1.0.0 is frozen, including its source identities and derivative checksums", () => {
  assert.equal(
    createHash("sha256").update(originalText).digest("hex"),
    "c4924d5575a43e01ec1dc39bf737a389f8c58348b0c6ac299fa46c062117ab00",
    "Publish a new version instead of changing released artwork or metadata",
  );
});

test("all 540 flags and their responsive files retain recorded hashes and dimensions", async () => {
  assert.equal(manifest.version, FLAG_ASSET_VERSION);
  assert.equal(manifest.flags.length, 540);
  assert.equal(new Set(manifest.flags.map((f) => f.id)).size, 540);
  assert.equal(manifest.flags.filter((f) => f.kind === "country").length, 242);
  assert.equal(
    manifest.flags.filter((f) => f.kind === "subdivision").length,
    298,
  );
  assert.doesNotMatch(
    manifestText,
    /localhost|127\.0\.0\.1|\/Users\/|service_role/i,
  );
  for (const flag of manifest.flags) {
    assert.deepEqual(
      flag.variants.map((variant) => variant.width),
      [48, 96, 144, 200, 400, 600],
    );
    for (const variant of flag.variants) {
      const data = await readFile(path.join(release, variant.file));
      assert.equal(
        createHash("sha256").update(data).digest("hex"),
        variant.sha256,
        variant.file,
      );
      assert.equal(data.length, variant.bytes, variant.file);
      const metadata = await sharp(data).metadata();
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, variant.width);
      assert.equal(metadata.height, variant.width);
    }
    assert.equal(flag.width, 400);
    assert.equal(flag.height, 400);
    const resolve =
      flag.kind === "country" ? getCountryFlagUrl : getSubdivisionFlagUrl;
    assert.equal(resolve(flag.code), `${FLAG_ASSET_BASE_PATH}/${flag.file}`);
    if (flag.isoCode) assert.equal(resolve(flag.isoCode), resolve(flag.code));
    assert.equal(
      getFlagSrcSet(resolve(flag.code)),
      flag.variants
        .map(
          (variant) =>
            `${FLAG_ASSET_BASE_PATH}/${variant.file} ${variant.width}w`,
        )
        .join(", "),
    );
  }
});

test("lookup handles aliases, custom map identities, casing and missing entries", () => {
  assert.equal(getCountryFlagUrl(" us "), getCountryFlagUrl("US"));
  assert.notEqual(getCountryFlagUrl("GF"), getCountryFlagUrl("FR"));
  assert.ok(getCountryFlagUrl("XA"));
  assert.ok(getSubdivisionFlagUrl("AU-X02~"));
  assert.equal(getSubdivisionFlagUrl("IN-CT"), getSubdivisionFlagUrl("IN-CG"));
  assert.equal(getSubdivisionFlagUrl("ZA-NL"), getSubdivisionFlagUrl("ZA-KZN"));
  for (const code of [
    undefined,
    null,
    "",
    " ",
    "UNKNOWN",
    "../US",
    "__proto__",
  ]) {
    assert.equal(getCountryFlagUrl(code), undefined);
    assert.equal(getSubdivisionFlagUrl(code), undefined);
  }
  assert.equal(
    getCountryFlagUrl("US", "https://assets.example.com/"),
    `https://assets.example.com${getCountryFlagUrl("US")}`,
  );
});

test("responsive sources support hosted URLs and leave other images alone", () => {
  const hosted = getCountryFlagUrl("US", "https://assets.example.com");
  assert.ok(
    getFlagSrcSet(hosted)
      .split(", ")
      .every((entry) =>
        entry.startsWith(`https://assets.example.com${FLAG_ASSET_BASE_PATH}/`),
      ),
  );
  for (const src of [
    null,
    "",
    "/images/flags/countries/us.svg",
    "/flags/1.0.0/missing/400.webp",
    "https://example.com/custom.png",
  ]) {
    assert.equal(getFlagSrcSet(src), undefined);
  }
});

test("the corner release changes only the 31 Chinese subdivision designs", async () => {
  const revised = manifest.flags.filter((flag) => flag.artworkRevision);
  assert.equal(revised.length, 31);
  for (const flag of manifest.flags) {
    const old = original.flags.find((previous) => previous.id === flag.id);
    if (flag.kind === "subdivision" && flag.parent === "CN") {
      assert.equal(flag.designKind, "custom");
      assert.equal(flag.artworkRevision.corner, "lower-right");
      assert.equal(flag.originalSourceSha256, old.sourceSha256);
      assert.notEqual(flag.sourceSha256, old.sourceSha256);
      const sources = JSON.parse(
        await readFile(new URL("../masters.json", import.meta.url), "utf8"),
      );
      const master = sources.entries.find(
        (entry) => entry.id === flag.id && entry.version === "1.1.0",
      );
      assert.equal(master.sha256, flag.sourceSha256);
    } else {
      assert.deepEqual(flag, old, flag.id);
    }
  }
});

test("a consumer gets a complete portable release, including the manifest", async () => {
  const target = await mkdtemp(path.join(os.tmpdir(), "flag-assets-"));
  try {
    const result = copyFlagAssets(target);
    assert.equal(
      await readFile(path.join(result, "manifest.json"), "utf8"),
      manifestText,
    );
    for (const variant of manifest.flags.flatMap((flag) => flag.variants)) {
      const data = await readFile(path.join(result, variant.file));
      assert.equal(
        createHash("sha256").update(data).digest("hex"),
        variant.sha256,
      );
    }
    assert.equal(copyFlagAssets(target), result);
    assert.equal((await readdir(path.join(result, "country"))).length, 242);
    assert.equal(
      await readFile(path.join(target, "flags/1.0.0/manifest.json"), "utf8"),
      originalText,
    );
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("version 1.1.0 is frozen", () => {
  assert.equal(
    createHash("sha256").update(manifestText).digest("hex"),
    "d0dbbec3c82c52472340fc6ecb7c6a274c2c1e2bb0ff8f0b88786ae5913f4df8",
    "Publish a new version instead of changing released artwork or metadata",
  );
});

test("the recovery archive includes exactly the 540 current masters", async () => {
  const { entries } = JSON.parse(await readFile(new URL("../masters.json", import.meta.url), "utf8"));
  assert.equal(entries.length, manifest.flags.length);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  for (const flag of manifest.flags) {
    const master = entries.find((entry) => entry.id === flag.id);
    assert.equal(master.sha256, flag.sourceSha256, flag.id);
    assert.equal(master.version, "1.1.0");
  }
});
