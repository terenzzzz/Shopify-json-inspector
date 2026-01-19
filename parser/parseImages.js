/**
 * 从 Shopify OS2.0 page / template JSON 中提取 shop_images 引用
 *
 * 规则：
 * - 只匹配 shopify://shop_images/
 * - 文件名保持原样（不改后缀）
 * - 全量递归遍历 JSON
 *
 * @param {object} json - 已解析的 JSON 对象
 * @returns {string[]} 去重后的图片文件名数组
 */
export function parseImages(json) {
  const images = new Set();

  function walk(value) {
    if (typeof value === 'string') {
      if (value.startsWith('shopify://shop_images/')) {
        images.add(
          value.replace('shopify://shop_images/', '')
        );
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (value && typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  }

  walk(json);

  return [...images];
}
