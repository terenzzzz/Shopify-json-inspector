/**
 * Shopify Page JSON 图片批量下载工具（迁移专用）
 *
 * 核心原则：
 * - 文件名 = JSON 中 shopify://shop_images/ 引用名
 * - 不根据 Content-Type 改扩展名
 *
 * 用法：
 * node shopify-image-downloader.js \
 *   --json page.open-ear-headphones-for-sports \
 *   --cdn https://uk.shokz.com/cdn/shop/files/ \
 *   --out images
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

/* ================= CLI 参数解析 ================= */

const args = process.argv.slice(2);

function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

function exitWithHelp(msg) {
  console.error(`\n❌ ${msg}\n`);
  console.error(
    'node shopify-image-downloader.js \\\n' +
    '  --json page.open-ear-headphones-for-sports \\\n' +
    '  --cdn https://uk.shokz.com/cdn/shop/files/ \\\n' +
    '  --out images\n'
  );
  process.exit(1);
}

let jsonFile = getArg('--json');
const CDN_PREFIX = getArg('--cdn');
const OUTPUT_DIR = getArg('--out');

if (!jsonFile) exitWithHelp('缺少参数 --json');
if (!CDN_PREFIX) exitWithHelp('缺少参数 --cdn');
if (!OUTPUT_DIR) exitWithHelp('缺少参数 --out');

// 自动补全 .json
if (!jsonFile.toLowerCase().endsWith('.json')) {
  jsonFile += '.json';
}

if (!fs.existsSync(jsonFile)) {
  exitWithHelp(`JSON 文件不存在: ${jsonFile}`);
}

/* ================= 读取 & 解析 JSON ================= */

const raw = fs.readFileSync(jsonFile, 'utf8');

// 移除 BOM + Shopify block comments
const clean = raw
  .replace(/^\uFEFF/, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

let json;
try {
  json = JSON.parse(clean);
} catch (e) {
  console.error('❌ JSON 解析失败');
  throw e;
}

/* ================= 提取 shop_images ================= */

const images = new Set();

function walk(v) {
  if (typeof v === 'string' && v.startsWith('shopify://shop_images/')) {
    images.add(v.replace('shopify://shop_images/', ''));
  } else if (v && typeof v === 'object') {
    Object.values(v).forEach(walk);
  }
}

walk(json);

if (!images.size) {
  console.log('⚠️ 未找到任何 shop_images 引用');
  process.exit(0);
}

/* ================= 下载逻辑 ================= */

const outDir = path.resolve(__dirname, OUTPUT_DIR);
fs.mkdirSync(outDir, { recursive: true });

console.log(`\n📦 图片数量: ${images.size}`);
console.log(`🌐 CDN 前缀: ${CDN_PREFIX}`);
console.log(`📁 输出目录: ${outDir}\n`);

function download(filename) {
  return new Promise(resolve => {
    const url = CDN_PREFIX + filename;
    const target = path.join(outDir, filename);

    https.get(
      url,
      {
        headers: {
          // 告诉 CDN：我支持 webp（但不强求）
          Accept: 'image/webp,image/*,*/*;q=0.8',
        },
      },
      res => {
        if (res.statusCode !== 200) {
          console.error(`❌ ${filename} (${res.statusCode})`);
          res.resume();
          return resolve();
        }

        const file = fs.createWriteStream(target);
        res.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`✅ ${filename}`);
          resolve();
        });
      }
    ).on('error', err => {
      console.error(`❌ ${filename} (${err.message})`);
      resolve();
    });
  });
}

/* ================= 执行 ================= */

(async () => {
  for (const img of images) {
    await download(img);
  }
  console.log('\n🎉 所有图片下载完成 \n');
  console.log(`📁 输出目录: ${outDir}\n`);
})();
