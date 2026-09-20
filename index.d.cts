export const FLAG_ASSET_VERSION: string;
export const FLAG_ASSET_BASE_PATH: string;
export function getFlagSrcSet(
  src: string | null | undefined,
): string | undefined;
export function getCountryFlagUrl(
  code: string | null | undefined,
  baseUrl?: string,
): string | undefined;
export function getSubdivisionFlagUrl(
  code: string | null | undefined,
  baseUrl?: string,
): string | undefined;
