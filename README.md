# Square flag assets

Version **1.1.0** contains 540 square designs: 242 countries and 298 subdivisions.
The 31 Chinese subdivision flags add custom yellow cultural symbols in the
lower-right corner, based on the user-supplied symbol list. The other 509 designs
are unchanged. These are square adaptations and custom geographic artwork.
The original **1.0.0** release remains available at its existing URLs.

The checked-in WebP files are ready to deploy. Builds do not need
Supabase, credentials, the original PNGs, or any network downloads. Each file has
a source hash in its directory name, under a frozen release version.
`assets/1.1.0/manifest.json` records names, map codes,
ISO aliases, source pages, available license metadata, design notes, original PNG
hashes, and release file hashes. Unknown source licenses remain explicitly null.

## Use in a website

Pin `"@workspace/flag-assets": "workspace:1.1.0"` in a monorepo consumer.
Copy the release when loading the site's build/development configuration:

```js
import { copyFlagAssets } from "@workspace/flag-assets/build";
copyFlagAssets("/absolute/path/to/site/public");
```

Resolve an image in browser or server code:

```js
import {
  getCountryFlagUrl,
  getSubdivisionFlagUrl,
  getFlagSrcSet,
} from "@workspace/flag-assets";

getCountryFlagUrl("US"); // /flags/1.1.0/country/us.<source-hash>/400.webp
getSubdivisionFlagUrl("US-CA");
getSubdivisionFlagUrl("IN-CG"); // Also resolves the catalog's older IN-CT code

const src = getCountryFlagUrl("US");
// React: <img src={src} srcSet={getFlagSrcSet(src)} sizes="48px" alt="United States" />
```

Lookup is case-insensitive, retains custom map identities, and returns
`undefined` for missing entries. Render the returned path as an ordinary image
with an appropriate text alternative. The client lookup imports only a compact
path index; it does not load every image or the full provenance manifest.

Each design has 48, 96, 144, 200, 400, and 600px derivatives. These cover
andr3wm's 48px review flags and 200px map panels at 1×, 2×, and 3× pixel density;
the 128/176px statistics panels use the closest suitable candidate too.
`CountryFlagArtwork` passes `srcSet` and its actual layout `sizes` to the browser,
which selects one candidate. `sizes` alone does not resize an image. Other
projects should also pass both attributes, or choose a file from the manifest.
The fallback `src` is 400px. No on-demand image server or runtime compression is
required, and these static images decode asynchronously.

andr3wm uses these URLs for its country and subdivision artwork, with its legacy
assets retained as fallbacks outside the release. Both andr3wm and the portfolio
copy this package to `public/flags/1.1.0` automatically, alongside retained releases. Those generated copies
are ignored by Git. Their deployment configurations set immutable caching and
public CORS headers on the versioned paths.

## Other projects and hosted URLs

`pnpm --filter @workspace/flag-assets pack --pack-destination /your/output/folder`
creates a portable npm tarball. Install the tarball in another project, or just
copy `assets/1.1.0` into its public `flags/1.1.0` directory. Native apps can bundle
the image files and use the JSON manifest without JavaScript.

After a website containing this release is deployed, its
`/flags/1.1.0/manifest.json` exposes the same file mapping. For an external site,
pass that deployed site's origin as the resolver's second argument:

```js
getCountryFlagUrl("US", "https://andrewmccarthy.cv");
```

This is a deployment path, not a separate hosted service. Shipping this package
does not itself deploy either site or publish an npm package.

## Deliberate updates only

Never replace assets or metadata inside a released version. Keep previous
versions in `assets/`; the build helper copies every retained release so their
old URLs keep working after a fresh deployment. Create a new package/release version and
update consumers explicitly when a design needs to change.

`scripts/release-local.mjs` is an explicit authoring tool, never a build hook. It
checks every original against the local import receipts, refuses an existing
release directory, and writes WebP derivatives at quality 85 with smart chroma
subsampling. It preserves the original design but resizes and compresses it;
the untouched 1254px PNGs stay
in the local authoring catalog and backups. Source hashes connect the derivatives
to those originals. The original release sources remain untouched.

For the Chinese corner-art revision, `scripts/release-corner-art.mjs` derives
only the 31 revised designs from the reviewed ImageGen masters in
`masters/1.1.0/`. That directory contains the full prompt set and PNG masters;
it is excluded from the portable npm tarball and website assets. The local CMS and websites use optimized WebPs; the release archive retains
the revised PNGs.

For a future full catalog release, bump the package version, run
`pnpm --filter @workspace/flag-assets release:local`, update the manifest export
and release tests, then review and pin the new version in each consumer.

Run `pnpm --filter @workspace/flag-assets test` to verify the release and portable
copy behavior.

## Public repository and recovery

The canonical asset repository is https://github.com/andr3wmccarthy/flag-assets.
This package is mounted at `packages/flag-assets` as a Git submodule in the
personal monorepo. Its commit is pinned: pulling the parent repository never
silently selects newer flag artwork.

After cloning the parent repository, run:

```sh
git submodule update --init --recursive
```

GitHub Actions check out submodules recursively. Vercel supports public HTTPS
submodules. The websites still serve local bundled WebPs; visitors do not need
to request images from GitHub or Supabase.

The `v1.1.0` GitHub release includes `current-flag-masters-1.1.0.tar.gz`: the 540 current PNG masters.
The 31 Chinese subdivision masters are the replacement yellow-symbol designs;
the superseded plain Chinese images are excluded. `masters.json`
records each file's SHA-256 hash. `recovery.json` pins the archive checksum.
The large PNGs are release attachments rather than Git blobs, keeping clones
small. Download the attachment with:

```sh
gh release download v1.1.0 --repo andr3wmccarthy/flag-assets --pattern 'current-flag-masters-1.1.0.tar.gz'
```

The CMS uses commit-pinned `raw.githubusercontent.com` URLs for 600px WebPs.
Full-resolution originals remain recoverable from the release; no flag image
needs to occupy Supabase Storage. Artwork provenance and any known source
licenses are recorded per flag; no blanket license is asserted for all artwork.

To deliberately update the submodule later, commit and push changes from inside
`packages/flag-assets`, then commit that folder's new Git pointer in the parent
repository. Regular work needs no special command once the submodule is
initialized. Avoid `git submodule update --remote` unless intentionally selecting
newer artwork.
