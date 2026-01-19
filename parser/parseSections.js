// parser/parseSections.js

/**
 * 从 Shopify OS2.0 page / template JSON 中提取 section 信息
 *
 * @param {object} json - 已解析的 JSON
 * @returns {{
 *   total: number,
 *   types: Array<[string, number]>
 * }}
 */
export function parseSections(json) {
  const sections = json?.sections;

  if (!sections || typeof sections !== 'object') {
    return {
      total: 0,
      types: [],
    };
  }

  const map = new Map();

  Object.values(sections).forEach(section => {
    if (section && typeof section === 'object' && section.type) {
      map.set(section.type, (map.get(section.type) || 0) + 1);
    }
  });

  return {
    total: Object.keys(sections).length,
    types: [...map.entries()].sort(([a], [b]) => a.localeCompare(b)),
  };
}
