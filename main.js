import { cleanJson } from './parser/cleanJson.js';
import { parseImages } from './parser/parseImages.js';
import { parseSections } from './parser/parseSections.js';
import { parseTemplateTree } from './parser/parseTemplateTree.js';

import { downloadImages } from './utils/downloadImages.js';
import { renderTreeNode } from './utils/renderTreeNode.js';

/* ================= DOM ================= */

const fileInput = document.getElementById('jsonFile');
const fileBtn = document.getElementById('fileBtn');
const clearBtn = document.getElementById('clearBtn');
const fileMeta = document.getElementById('fileMeta');
const cdnInput = document.getElementById('cdn');

const imagesEl = document.getElementById('images');
const sectionsEl = document.getElementById('sections');

/* ================= State ================= */

let lastImages = [];
let lastSections = null;
let templateTree = null;

/* ================= Utils ================= */

/**
 * Normalize CDN input
 * 支持：
 * - CDN prefix
 * - CDN prefix/
 * - 完整图片 URL（含 ?v=）
 */
function normalizeCdn(input) {
  if (!input) return '';

  const match = input.match(/^(https?:\/\/[^/]+\/cdn\/shop\/files)/);
  if (match) return match[1];

  return input.replace(/\/$/, '');
}

/* ================= Core Loader ================= */

function loadTemplateJson(raw, sourceLabel = '') {
  let json;

  try {
    json = JSON.parse(cleanJson(raw));
  } catch (e) {
    console.error(e);
    alert('JSON parse failed');
    return;
  }

  lastImages = parseImages(json);
  lastSections = parseSections(json);
  templateTree = parseTemplateTree(json, sourceLabel);

  renderImages();
  renderSections();
  renderStructure(templateTree);
}

/* ================= Clear ================= */

function clearAll() {
  // inputs
  fileInput.value = '';
  if (jsonPaste) jsonPaste.value = '';
  fileMeta.textContent = 'No file selected';
  cdnInput.value = '';

  // data
  lastImages = [];
  lastSections = null;
  templateTree = null;

  // UI
  imagesEl.classList.add('hidden');
  sectionsEl.classList.add('hidden');
  imagesEl.innerHTML = '';
  sectionsEl.innerHTML = '';

  const structureEl = document.getElementById('structure');
  if (structureEl) structureEl.innerHTML = '';
}

clearBtn.onclick = clearAll;

/* ================= File Picker ================= */

fileBtn.onclick = () => fileInput.click();

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;

  fileMeta.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

  // 文件优先，清空粘贴内容
  if (jsonPaste) jsonPaste.value = '';

  const raw = await file.text();
  loadTemplateJson(raw, file.name);
});

/* ================= JSON 读取 & 解析 ================= */

let pasteTimer = null;

jsonPaste.addEventListener('input', () => {
  clearTimeout(pasteTimer);

  pasteTimer = setTimeout(() => {
    const raw = jsonPaste.value.trim();
    if (!raw) return;

    // 粘贴优先，清空文件
    fileInput.value = '';
    fileMeta.textContent = 'Pasted JSON';

    loadTemplateJson(raw, 'pasted.json');
  }, 300);
});

/* ================= CDN 变化 → 重新渲染 Images ================= */

let cdnTimer;
cdnInput.addEventListener('input', () => {
  if (!lastImages.length) return;

  clearTimeout(cdnTimer);
  cdnTimer = setTimeout(() => {
    renderImages();
  }, 300);
});

/* ================= 渲染 Images（Grid） ================= */

function renderImages() {
  if (!lastImages.length) return;

  imagesEl.classList.remove('hidden');

  const cdn = normalizeCdn(cdnInput.value);

  imagesEl.innerHTML = `
    <h3>
      <span>🖼 Images</span>
      <span>${lastImages.length}</span>
    </h3>

    <div class="image-grid">
      ${lastImages
        .map(name => {
          const src = cdn ? `${cdn}/${name}` : '';
          return `
            <div class="image-item">
              <div class="thumb">
                ${
                  src
                    ? `<img src="${src}" loading="lazy"
                        onerror="this.style.display='none'" />`
                    : ''
                }
              </div>
              <div class="name">${name}</div>
            </div>
          `;
        })
        .join('')}
    </div>

    <button id="download">Download ZIP</button>
  `;

  document.getElementById('download').onclick = () => {
    downloadImages(lastImages, cdn);
  };
}

/* ================= 渲染 Sections（双卡同一行） ================= */

function renderSections() {
  if (!lastSections) return;

  sectionsEl.classList.remove('hidden');

  const { total, types } = lastSections;

  sectionsEl.innerHTML = `
    <div class="section-row">
      <!-- 左：Sections 统计 -->
      <div class="card">
        <h3>
          <span>🧩 Sections</span>
          <span>${total}</span>
        </h3>

        <div class="list">
          ${types
            .map(
              ([type, count]) => `
                <div class="row">
                  <span>${type}</span>
                  <span>x${count}</span>
                </div>
              `
            )
            .join('')}
        </div>
      </div>

      <!-- 右：Structure -->
      <div class="card">
        <h3>
          <span>🌳 Structure</span>
        </h3>

        <div id="structure"></div>
      </div>
    </div>
  `;
}

/* ================= 渲染 Structure（独立） ================= */

function renderStructure(tree) {
  const el = document.getElementById('structure');
  if (!el) return;

  if (!tree) {
    el.innerHTML = `<div class="muted">No structure</div>`;
    return;
  }

  const textTree = renderTreeNode(tree);

  el.innerHTML = `
    <pre class="structure-tree">${textTree}</pre>
  `;
}
