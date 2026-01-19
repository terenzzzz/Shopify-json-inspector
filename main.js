import { cleanJson } from './parser/cleanJson.js';
import { parseImages } from './parser/parseImages.js';
import { parseSections } from './parser/parseSections.js';
import { downloadImages } from './utils/downloadImages.js';

const fileInput = document.getElementById('jsonFile');
const cdnInput = document.getElementById('cdn');

/* ================= JSON 读取 & 解析 ================= */

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const raw = await file.text();
  let json;

  try {
    json = JSON.parse(cleanJson(raw));
  } catch (e) {
    console.error(e);
    alert('JSON parse failed');
    return;
  }

  const images = parseImages(json);
  const sections = parseSections(json);

  renderImages(images);
  renderSections(sections);
});

/* ================= 渲染 Images ================= */

function renderImages(images) {
  const el = document.getElementById('images');
  el.classList.remove('hidden');

  el.innerHTML = `
    <h3>📦 Images (${images.length})</h3>
    <div class="list">
      ${images.map(name => `
        <div class="row">
          <span>${name}</span>
          <span class="ok">✓</span>
        </div>
      `).join('')}
    </div>
    <button id="download">Download ZIP</button>
  `;

  const btn = document.getElementById('download');
  btn.onclick = () => {
    downloadImages(images, cdnInput.value);
  };
}

/* ================= 渲染 Sections ================= */

function renderSections({ total, types }) {
  const el = document.getElementById('sections');
  el.classList.remove('hidden');

  el.innerHTML = `
    <h3>🧩 Sections (${total})</h3>
    <div class="list">
      ${types.map(([type, count]) => `
        <div class="row">
          <span>${type}</span>
          <span>x${count}</span>
        </div>
      `).join('')}
    </div>
  `;
}
