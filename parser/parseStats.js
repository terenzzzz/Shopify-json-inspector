export function parseStats(json) {
  const sections = json?.sections || {};

  let sectionCount = 0;
  let disabledSections = 0;

  let blockCount = 0;
  let disabledBlocks = 0;

  Object.values(sections).forEach(section => {
    if (!section || !section.type) return;

    sectionCount++;
    if (section.disabled) disabledSections++;

    const blocks = section.blocks || {};
    Object.values(blocks).forEach(block => {
      if (!block || !block.type) return;

      blockCount++;
      if (block.disabled) disabledBlocks++;
    });
  });

  const disabledSectionRatio = sectionCount
    ? disabledSections / sectionCount
    : 0;

  const disabledBlockRatio = blockCount
    ? disabledBlocks / blockCount
    : 0;

  const imageStats = parseImageStats(json);

  return {
    sections: {
      total: sectionCount,
      disabled: disabledSections,
      ratio: disabledSectionRatio,
    },

    blocks: {
      total: blockCount,
      disabled: disabledBlocks,
      ratio: disabledBlockRatio,
    },

    images: imageStats,

    complexity: calcComplexity({
      sections: sectionCount,
      blocks: blockCount,
      images: imageStats.references,
      disabledSections,
    }),

    signals: buildSignals({
      sectionCount,
      blockCount,
      imageStats,
      disabledSectionRatio,
      disabledBlockRatio,
    }),
  };
}

/* ================= Helpers ================= */

/**
 * 统计图片：
 * - unique: 唯一图片数量
 * - references: 被引用次数
 * - reused: 引用 ≥ 2 的图片数量
 */
function parseImageStats(json) {
  const map = new Map();

  function walk(value) {
    if (typeof value === 'string') {
      if (value.startsWith('shopify://shop_images/')) {
        const name = value.replace('shopify://shop_images/', '');
        map.set(name, (map.get(name) || 0) + 1);
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

  const unique = map.size;
  const references = [...map.values()].reduce((a, b) => a + b, 0);
  const reused = [...map.values()].filter(v => v > 1).length;

  return { unique, references, reused };
}

function calcComplexity({ sections, blocks, images, disabledSections }) {
  const score =
    sections * 2 +
    blocks * 1 +
    images * 1.5 +
    disabledSections * 0.5;

  let level = 'Low';
  if (score > 80) level = 'High';
  else if (score > 40) level = 'Medium';

  return {
    score: Math.round(score),
    level,
  };
}

function buildSignals({
  sectionCount,
  blockCount,
  imageStats,
  disabledSectionRatio,
  disabledBlockRatio,
}) {
  const signals = [];

  if (disabledSectionRatio > 0.3)
    signals.push('High disabled section ratio');

  if (disabledBlockRatio > 0.4)
    signals.push('Many disabled blocks');

  if (imageStats.references > 40)
    signals.push('Heavy image usage');

  if (imageStats.reused > imageStats.unique * 0.4)
    signals.push('High image reuse coupling');

  if (sectionCount > 18)
    signals.push('Too many sections');

  if (blockCount > 50)
    signals.push('Complex block structure');

  return signals;
}
