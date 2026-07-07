import { cleanJson } from "./parser/cleanJson.js";
import { parseImages } from "./parser/parseImages.js";
import { parseVideos } from "./parser/parseVideos.js";
import { parseSections } from "./parser/parseSections.js";
import { parseTemplateTree } from "./parser/parseTemplateTree.js";
import { parseStats } from "./parser/parseStats.js";

import { renderImages } from "./ui/renderImages.js";
import { renderVideos } from "./ui/renderVideos.js";
import { renderSections } from "./ui/renderSections.js";
import { renderStats } from "./ui/renderStats.js";
import { renderStructure } from "./ui/renderStructure.js";
import { initJsonBubble } from "./ui/jsonBubble.js";
import { initModal, showModal } from "./utils/showModal.js";

/* ================= Init ================= */
initModal();
initJsonBubble();

/* ================= DOM ================= */

const fileInput = document.getElementById("jsonFile");
const fileBtn = document.getElementById("fileBtn");
const clearBtn = document.getElementById("clearBtn");
const fileMeta = document.getElementById("fileMeta");
const cdnInput = document.getElementById("cdn");
const zipNameInput = document.getElementById("zipName");
const jsonPaste = document.getElementById("jsonPaste"); // Fixed missing reference
const imagesEl = document.getElementById("images");
const videosEl = document.getElementById("videos");
const sectionsEl = document.getElementById("sections");
const initialStateEl = document.getElementById("initialState");

/* ================= State ================= */
let lastStats = null;
let lastImages = [];
let lastVideos = [];
let lastSections = null;
let templateTree = null;
let lastTemplateName = "template.json";

/* ================= Utils ================= */

/**
 * Normalize CDN input
 * Supports:
 * - CDN prefix
 * - CDN prefix/
 * - Full image URL (including ?v=)
 */
function normalizeCdn(prefix) {
  if (!prefix) return "";

  // Remove trailing slashes
  prefix = prefix.replace(/\/+$/, "");

  // If not ending with /files, append it
  if (!prefix.endsWith("/files")) {
    prefix += "/files";
  }

  return prefix + "/";
}

/* ================= Core Loader ================= */

function loadTemplateJson(raw, sourceLabel = "") {
  let json;

  try {
    json = JSON.parse(cleanJson(raw));
  } catch (e) {
    console.error(e);
    showModal("JSON 解析失败：" + e.message);
    return;
  }

  lastStats = parseStats(json);
  lastImages = parseImages(json);
  lastVideos = parseVideos(json);
  lastSections = parseSections(json);
  templateTree = parseTemplateTree(json, sourceLabel);
  lastTemplateName = sourceLabel || "template.json";
  if (zipNameInput) {
    zipNameInput.placeholder = stripExt(lastTemplateName);
  }

  // Hide initial empty state
  if (initialStateEl) initialStateEl.classList.add("hidden");

  renderStats(lastStats);
  renderImages(lastImages, normalizeCdn(cdnInput.value));
  renderVideos(lastVideos, normalizeCdn(cdnInput.value));
  renderSections(lastSections);
  renderStructure(templateTree);
}

/* ================= Clear ================= */

function clearAll() {
  // inputs
  fileInput.value = "";
  if (jsonPaste) jsonPaste.value = "";
  fileMeta.textContent = "未选择文件";
  cdnInput.value = "";
  const shopDomainInput = document.getElementById("shopDomain");
  const adminTokenInput = document.getElementById("adminToken");
  const downloadOriginalInput = document.getElementById("downloadOriginal");
  if (shopDomainInput) shopDomainInput.value = "";
  if (adminTokenInput) adminTokenInput.value = "";
  if (downloadOriginalInput) downloadOriginalInput.checked = false;
  if (zipNameInput) {
    zipNameInput.value = "";
    zipNameInput.placeholder = "";
  }

  // data
  lastImages = [];
  lastVideos = [];
  lastSections = null;
  templateTree = null;

  // UI
  imagesEl.classList.add("hidden");
  if (videosEl) videosEl.classList.add("hidden");
  sectionsEl.classList.add("hidden");
  if (initialStateEl) initialStateEl.classList.remove("hidden");
  imagesEl.innerHTML = "";
  if (videosEl) videosEl.innerHTML = "";
  sectionsEl.innerHTML = "";
  
  const statsEl = document.getElementById("stats");
  if (statsEl) {
    statsEl.classList.add("hidden");
    statsEl.innerHTML = "";
  }

  const structureEl = document.getElementById("structure");
  if (structureEl) structureEl.innerHTML = "";
}

clearBtn.onclick = clearAll;

/* ================= File Picker ================= */

fileBtn.onclick = () => fileInput.click();

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  fileMeta.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

  // File priority, clear paste
  if (jsonPaste) jsonPaste.value = "";

  const raw = await file.text();
  loadTemplateJson(raw, file.name);
});

/* ================= JSON Paste ================= */

let pasteTimer = null;

if (jsonPaste) {
  jsonPaste.addEventListener("input", () => {
    clearTimeout(pasteTimer);

    pasteTimer = setTimeout(() => {
      const raw = jsonPaste.value.trim();
      if (!raw) return;

      // Paste priority, clear file
      fileInput.value = "";
      fileMeta.textContent = "已粘贴 JSON";

      loadTemplateJson(raw, "粘贴.json");
    }, 300);
  });
}

/* ================= CDN Change ================= */

let cdnTimer;
cdnInput.addEventListener("input", () => {
  if (!lastImages.length && !lastVideos.length) return;

  clearTimeout(cdnTimer);
  cdnTimer = setTimeout(() => {
    const cdn = normalizeCdn(cdnInput.value);
    renderImages(lastImages, cdn);
    renderVideos(lastVideos, cdn);
  }, 300);
});

/* ================= Drag & Drop ================= */
const dropZone = document.getElementById("dropZone");


if (dropZone) {
  let dragCounter = 0;

  document.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragCounter++;
    dropZone.classList.remove("hidden");
  });

  document.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropZone.classList.add("hidden");
    }
  });

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  document.addEventListener("drop", async (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropZone.classList.add("hidden");

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.type === "application/json" || file.name.endsWith(".json")) {
      fileMeta.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      if (jsonPaste) jsonPaste.value = "";
      
      const raw = await file.text();
      loadTemplateJson(raw, file.name);
    } else {
      showModal("请拖入有效的 JSON 文件（.json）");
    }
  });
}

function stripExt(name) {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}
