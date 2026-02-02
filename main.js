import { cleanJson } from "./parser/cleanJson.js";
import { parseImages } from "./parser/parseImages.js";
import { parseSections } from "./parser/parseSections.js";
import { parseTemplateTree } from "./parser/parseTemplateTree.js";
import { parseStats } from "./parser/parseStats.js";

import { renderImages } from "./ui/renderImages.js";
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
const jsonPaste = document.getElementById("jsonPaste"); // Fixed missing reference
const imagesEl = document.getElementById("images");
const sectionsEl = document.getElementById("sections");
const initialStateEl = document.getElementById("initialState");

/* ================= State ================= */
let lastStats = null;
let lastImages = [];
let lastSections = null;
let templateTree = null;

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
    showModal("JSON parse failed: " + e.message);
    return;
  }

  lastStats = parseStats(json);
  lastImages = parseImages(json);
  lastSections = parseSections(json);
  templateTree = parseTemplateTree(json, sourceLabel);

  // Hide initial empty state
  if (initialStateEl) initialStateEl.classList.add("hidden");

  renderStats(lastStats);
  renderImages(lastImages, normalizeCdn(cdnInput.value));
  renderSections(lastSections);
  renderStructure(templateTree);
}

/* ================= Clear ================= */

function clearAll() {
  // inputs
  fileInput.value = "";
  if (jsonPaste) jsonPaste.value = "";
  fileMeta.textContent = "No file selected";
  cdnInput.value = "";

  // data
  lastImages = [];
  lastSections = null;
  templateTree = null;

  // UI
  imagesEl.classList.add("hidden");
  sectionsEl.classList.add("hidden");
  if (initialStateEl) initialStateEl.classList.remove("hidden");
  imagesEl.innerHTML = "";
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
      fileMeta.textContent = "Pasted JSON";

      loadTemplateJson(raw, "pasted.json");
    }, 300);
  });
}

/* ================= CDN Change ================= */

let cdnTimer;
cdnInput.addEventListener("input", () => {
  if (!lastImages.length) return;

  clearTimeout(cdnTimer);
  cdnTimer = setTimeout(() => {
    renderImages(lastImages, normalizeCdn(cdnInput.value));
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
      showModal("Please drop a valid JSON file (.json)");
    }
  });
}
