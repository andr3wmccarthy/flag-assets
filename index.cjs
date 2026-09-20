const catalog = require("./urls.json");

const FLAG_ASSET_VERSION = catalog.version;
const FLAG_ASSET_BASE_PATH = `/flags/${FLAG_ASSET_VERSION}`;
const flagFiles = new Set(Object.values(catalog.flags));

function flagUrl(kind, code, baseUrl = "") {
  if (!code) return undefined;
  const id = `${kind}:${code.trim().toUpperCase()}`;
  if (!Object.hasOwn(catalog.flags, id)) return undefined;
  return `${baseUrl.replace(/\/$/, "")}${FLAG_ASSET_BASE_PATH}/${catalog.flags[id]}`;
}

function getCountryFlagUrl(code, baseUrl) {
  return flagUrl("country", code, baseUrl);
}

function getSubdivisionFlagUrl(code, baseUrl) {
  return flagUrl("subdivision", code, baseUrl);
}

/** Supplies static responsive candidates only for files in this frozen release. */
function getFlagSrcSet(src) {
  if (!src) return undefined;
  const prefix = `${FLAG_ASSET_BASE_PATH}/`;
  const offset = src.indexOf(prefix);
  if (offset < 0 || !flagFiles.has(src.slice(offset + prefix.length)))
    return undefined;
  const directory = src.slice(0, src.lastIndexOf("/") + 1);
  return catalog.widths
    .map((width) => `${directory}${width}.webp ${width}w`)
    .join(", ");
}

exports.FLAG_ASSET_VERSION = FLAG_ASSET_VERSION;
exports.FLAG_ASSET_BASE_PATH = FLAG_ASSET_BASE_PATH;
exports.getCountryFlagUrl = getCountryFlagUrl;
exports.getSubdivisionFlagUrl = getSubdivisionFlagUrl;
exports.getFlagSrcSet = getFlagSrcSet;
