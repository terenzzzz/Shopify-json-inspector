/**
 * Shopify Page / Template JSON
 * 输出所有 section 的 type（去重）
 *
 * 用法：
 * node shopify-section-types.js --json page.open-ear-headphones-for-sports
 */

const fs = require('fs');
const path = require('path');

/* ================= CLI 参数解析 ================= */

const args = process.argv.slice(2);

function getArg(flag) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

function exitWithHelp(message) {
  console.error(`\n❌ ${message}\n`);
  console.error('👉 用法示例：');
  console.error(
    'node shopify-section-types.js \\\n' +
    '  --json page.open-ear-headphones-for-sports\n'
  );
  process.exit(1);
}

let inputFile = getArg('--json');

if (!inputFile) exitWithHelp('缺少参数 --json');

/* ================= 文件处理 ================= */

// 自动补全 .json
if (!inputFile.toLowerCase().endsWith('.json')) {
  inputFile += '.json';
}

if (!fs.existsSync(inputFile)) {
  exitWithHelp(`JSON 文件不存在: ${inputFile}`);
}

/* ================= 读取 & 解析 JSON ================= */

const raw = fs.readFileSync(inputFile, 'utf8');

// Shopify JSON 会包含 block comments
const clean = raw
  .replace(/^\uFEFF/, '')               // BOM
  .replace(/\/\*[\s\S]*?\*\//g, '');    // /* ... */

let json;
try {
  json = JSON.parse(clean);
} catch (e) {
  console.error('❌ JSON 解析失败');
  throw e;
}

/* ================= 提取 section types ================= */

const sections = json.sections;

if (!sections || typeof sections !== 'object') {
  console.log('⚠️ JSON 中未找到 sections 字段');
  process.exit(0);
}

const types = new Set();

Object.values(sections).forEach(section => {
  if (section && typeof section === 'object' && section.type) {
    types.add(section.type);
  }
});

/* ================= 输出 ================= */

console.log(`\n📄 JSON 文件: ${inputFile}`);
console.log(`📦 Sections 总数: ${Object.keys(sections).length}`);
console.log('🧩 Section Types（去重）:\n');

[...types].sort().forEach(type => {
  console.log(`- ${type}`);
});

console.log(`\n✅ 共 ${types.size} 个不同的 section\n`);
