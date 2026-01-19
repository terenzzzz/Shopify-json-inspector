export function cleanJson(raw) {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}