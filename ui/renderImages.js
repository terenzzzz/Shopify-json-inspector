import {
  buildDownloadUrl,
  canResumeDownload,
  clearDownloadSession,
  downloadImages,
  fetchDownloadImageSize,
  resumeDownloadImages,
} from "../utils/downloadImages.js";

const selectedImageNames = new Set();
let lastRenderedImagesKey = "";
const LARGE_IMAGE_BYTES = 300 * 1024;

function isWebpImage(name) {
  return /\.webp$/i.test(name || "");
}

function imageExtension(name) {
  const match = (name || "").match(/\.([^.]+)$/);
  return match ? match[1].toUpperCase() : "未知";
}

function formatFileSize(bytes) {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isLargeImage(bytes) {
  return bytes != null && bytes > LARGE_IMAGE_BYTES;
}

function updateLargeImageHint() {
  const hint = document.getElementById("image-size-hint");
  const countEl = document.getElementById("image-large-count");
  if (!hint || !countEl) return;

  const count = document.querySelectorAll(".image-item--large").length;
  if (count > 0) {
    countEl.textContent = String(count);
    hint.classList.remove("hidden");
  } else {
    hint.classList.add("hidden");
  }
}

function applyLargeImageHighlight(sizeEl, size) {
  if (!isLargeImage(size)) return;

  sizeEl.classList.add("image-size--large");
  const item = sizeEl.closest(".image-item");
  if (item) {
    item.classList.add("image-item--large");
    const existingTitle = item.getAttribute("title") || "";
    if (!existingTitle.includes("超过 300 KB")) {
      item.setAttribute(
        "title",
        existingTitle
          ? `${existingTitle}；文件超过 300 KB，建议压缩`
          : "文件超过 300 KB，建议压缩",
      );
    }
  }
}

async function loadImageSizes(cdnPrefix) {
  const sizeEls = [...document.querySelectorAll(".image-size[data-name]")];
  if (!sizeEls.length || !cdnPrefix) return;

  const concurrency = 5;
  let index = 0;

  async function worker() {
    while (index < sizeEls.length) {
      const current = index++;
      const el = sizeEls[current];
      const name = el.dataset.name;
      if (!name) continue;

      el.textContent = "加载中…";
      const size = await fetchDownloadImageSize(cdnPrefix, name);
      el.textContent = size != null ? formatFileSize(size) : "未知";
      el.classList.toggle("image-size--error", size == null);
      if (size != null) applyLargeImageHighlight(el, size);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, sizeEls.length) }, worker),
  );

  updateLargeImageHint();
}

function syncSelectionState() {
  document.querySelectorAll(".image-item").forEach((item) => {
    const name = item.dataset.name;
    const selected = selectedImageNames.has(name);
    item.classList.toggle("is-selected", selected);
    const checkBtn = item.querySelector(".image-select-check");
    checkBtn?.classList.toggle("is-checked", selected);
    checkBtn?.setAttribute("aria-pressed", String(selected));
  });
  updateSelectionUI();
}

function updateSelectionUI() {
  const count = selectedImageNames.size;
  const countEl = document.getElementById("image-selected-count");
  const downloadSelectedBtn = document.getElementById("download-selected");

  if (countEl) {
    countEl.textContent = count > 0 ? `已选 ${count} 张` : "未选择";
  }

  if (downloadSelectedBtn) {
    downloadSelectedBtn.disabled = count === 0;
    downloadSelectedBtn.textContent =
      count > 0 ? `下载选中 (${count})` : "下载选中";
  }
}

function toggleImageSelection(name, item) {
  if (selectedImageNames.has(name)) {
    selectedImageNames.delete(name);
  } else {
    selectedImageNames.add(name);
  }

  item.classList.toggle("is-selected", selectedImageNames.has(name));
  const checkBtn = item.querySelector(".image-select-check");
  checkBtn?.classList.toggle("is-checked", selectedImageNames.has(name));
  checkBtn?.setAttribute("aria-pressed", String(selectedImageNames.has(name)));
  updateSelectionUI();
}

function setupImageSelection(images) {
  document.querySelectorAll(".image-item").forEach((item) => {
    const name = item.dataset.name;
    if (!name) return;

    item.querySelector(".image-select-check")?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleImageSelection(name, item);
    });

    item.querySelector(".name")?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleImageSelection(name, item);
    });
  });

  document.getElementById("select-all-images")?.addEventListener("click", () => {
    images.forEach((name) => selectedImageNames.add(name));
    syncSelectionState();
  });

  document.getElementById("clear-selection")?.addEventListener("click", () => {
    selectedImageNames.clear();
    syncSelectionState();
  });

  syncSelectionState();
}

function getDownloadOptions() {
  const downloadOriginal = document.getElementById("downloadOriginal")?.checked;
  const shopDomain = document.getElementById("shopDomain")?.value?.trim() || "";
  const adminToken = document.getElementById("adminToken")?.value?.trim() || "";

  return downloadOriginal
    ? {
        mode: "original",
        admin: {
          shop: shopDomain,
          token: adminToken,
        },
      }
    : { mode: "cdn" };
}

function getZipBaseName() {
  const zipInput = document.getElementById("zipName");
  return (
    (zipInput?.value || "").trim() ||
    (zipInput?.placeholder || "").trim() ||
    "shopify-images"
  );
}

async function runImageDownload(imagesToDownload, cdnPrefix, btn, defaultLabel) {
  if (!imagesToDownload.length) return;

  btn.disabled = true;
  btn.textContent = "下载中…";
  setResumeDownloadVisible(false);

  try {
    await downloadImages(
      imagesToDownload,
      cdnPrefix,
      getZipBaseName(),
      updateDownloadProgress,
      showDownloadResult,
      getDownloadOptions(),
    );
  } finally {
    btn.disabled = false;
    btn.textContent = defaultLabel;
    updateSelectionUI();
    updateResumeDownloadButton();
  }
}

function setResumeDownloadVisible(visible) {
  const resumeBtn = document.getElementById("download-resume");
  if (!resumeBtn) return;
  resumeBtn.classList.toggle("hidden", !visible);
}

function updateResumeDownloadButton() {
  const resumeBtn = document.getElementById("download-resume");
  if (!resumeBtn) return;

  const canResume = canResumeDownload();
  resumeBtn.classList.toggle("hidden", !canResume);
  if (canResume) {
    resumeBtn.disabled = false;
    resumeBtn.textContent = "恢复下载";
  }
}

async function runResumeDownload() {
  const resumeBtn = document.getElementById("download-resume");
  if (!resumeBtn || !canResumeDownload()) return;

  resumeBtn.disabled = true;
  resumeBtn.textContent = "恢复中…";

  try {
    await resumeDownloadImages(updateDownloadProgress, showDownloadResult);
  } finally {
    updateResumeDownloadButton();
  }
}

function setupDownloadButtons(images, cdnPrefix) {
  const downloadAllBtn = document.getElementById("download");
  const downloadSelectedBtn = document.getElementById("download-selected");
  const resumeBtn = document.getElementById("download-resume");

  if (downloadAllBtn) {
    downloadAllBtn.onclick = () =>
      runImageDownload(images, cdnPrefix, downloadAllBtn, "下载全部 ZIP");
  }

  if (downloadSelectedBtn) {
    downloadSelectedBtn.onclick = () => {
      const selected = images.filter((name) => selectedImageNames.has(name));
      const label =
        selected.length > 0 ? `下载选中 (${selected.length})` : "下载选中";
      runImageDownload(selected, cdnPrefix, downloadSelectedBtn, label);
    };
  }

  if (resumeBtn) {
    resumeBtn.onclick = () => runResumeDownload();
  }

  updateResumeDownloadButton();
}

export function renderImages(images, cdnPrefix) {
  const imagesEl = document.getElementById("images");
  if (!images || !imagesEl) return;

  imagesEl.classList.remove("hidden");

  if (images.length === 0) {
    imagesEl.innerHTML = `
      <h3>
        <span>🖼 图片</span>
        <span>0</span>
      </h3>
      <div class="empty-state">
        <div class="empty-icon">🖼️</div>
        <div class="empty-text">未发现图片</div>
        <div class="empty-subtext">该模板中未检测到图片引用。</div>
      </div>
    `;
    return;
  }

  const imagesKey = images.join("\0");
  if (imagesKey !== lastRenderedImagesKey) {
    selectedImageNames.clear();
    clearDownloadSession();
    lastRenderedImagesKey = imagesKey;
  } else {
    for (const name of selectedImageNames) {
      if (!images.includes(name)) selectedImageNames.delete(name);
    }
  }

  const nonWebpImages = images.filter((name) => !isWebpImage(name));

  imagesEl.innerHTML = `
    <h3>
      <span>🖼 图片</span>
      <span>${images.length}</span>
    </h3>

    <div class="image-toolbar">
      <div class="image-toolbar-left">
        <button type="button" id="select-all-images" class="btn-secondary">全选</button>
        <button type="button" id="clear-selection" class="btn-secondary">取消选择</button>
        <span class="image-select-hint">点击勾选框或文件名选中，点击图片预览</span>
      </div>
      <span id="image-selected-count" class="image-selected-count">未选择</span>
    </div>

    <div class="image-grid">
      ${images
        .map((name) => {
          const src = cdnPrefix ? `${cdnPrefix}/${name}` : "";
          const isWebp = isWebpImage(name);
          const isSelected = selectedImageNames.has(name);
          return `
            <div class="image-item${isWebp ? "" : " image-item--non-webp"}${isSelected ? " is-selected" : ""}" data-name="${name}" title="${isWebp ? "" : "非 WebP 格式，建议转换"}">
              <button
                type="button"
                class="image-select-check${isSelected ? " is-checked" : ""}"
                aria-label="选择图片 ${name}"
                aria-pressed="${isSelected}"
              ></button>
              <div class="thumb">
                ${
                  src
                    ? `<img src="${src}" loading="lazy" data-name="${name}" class="preview-img"
                        onerror="this.style.display='none'" />`
                    : ""
                }
                ${isWebp ? "" : `<span class="image-format-badge">${imageExtension(name)}</span>`}
              </div>
              <div class="name">${name}</div>
              ${
                src
                  ? `<div class="image-size" data-name="${name}">—</div>`
                  : `<div class="image-size image-size--muted">需配置 CDN</div>`
              }
            </div>
          `;
        })
        .join("")}
    </div>

    ${
      nonWebpImages.length > 0
        ? `
      <div class="image-format-hint" role="status">
        <strong>格式建议</strong>
        <p>检测到 <strong>${nonWebpImages.length}</strong> 张图片不是 WebP 格式（已在上方高亮显示）。建议使用 <code>.webp</code> 格式以减小文件体积、提升页面加载速度。</p>
      </div>
    `
        : ""
    }

    <div id="image-size-hint" class="image-size-hint hidden" role="status">
      <strong>体积建议</strong>
      <p>检测到 <strong id="image-large-count">0</strong> 张图片超过 300 KB（已在上方高亮显示）。建议压缩图片或转换为 WebP 格式以优化页面加载性能。</p>
    </div>

    <div class="image-download-actions">
      <button type="button" id="download-selected" class="btn-secondary" disabled>下载选中</button>
      <button type="button" id="download">下载全部 ZIP</button>
      <button type="button" id="download-resume" class="btn-secondary hidden">恢复下载</button>
    </div>

    <div id="download-progress" class="progress-wrapper hidden">
      <div class="progress-info">
        <span id="progress-text">0 / 0</span>
        <span id="progress-result"></span>
      </div>
      <div class="progress-track">
        <div id="progress-bar" class="progress-bar"></div>
      </div>
    </div>
  `;

  setupImageSelection(images);
  setupDownloadButtons(images, cdnPrefix);

  // 图片预览 Modal
  setupImageModal(cdnPrefix);

  if (cdnPrefix) {
    loadImageSizes(cdnPrefix);
  }
}

function setupImageModal(cdnPrefix) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImg");
  const modalName = document.getElementById("modalName");
  const modalSize = document.getElementById("modalSize");
  const modalUrl = document.getElementById("modalUrl");
  const modalDimensions = document.getElementById("modalDimensions");
  const modalClose = document.getElementById("modalClose");

  if (!modal || !modalImg) return;

  document.querySelectorAll(".preview-img").forEach(img => {
    img.onclick = async (e) => {
      e.stopPropagation();
      const name = img.dataset.name || "";
      const downloadUrl = cdnPrefix && name ? buildDownloadUrl(cdnPrefix, name) : img.src;

      modalName.textContent = name;
      modalSize.textContent = "加载中…";
      if (modalDimensions) modalDimensions.textContent = "加载中…";
      modalUrl.innerHTML = `<a href="${downloadUrl}" target="_blank" rel="noopener noreferrer">${downloadUrl}</a>`;

      modal.classList.remove("hidden");

      const modalLeft = modal.querySelector(".modal-left");
      if (modalLeft) modalLeft.classList.add("is-loading");
      modalImg.style.opacity = "0";
      modalImg.src = img.src;

      try {
        const size =
          cdnPrefix && name
            ? await fetchDownloadImageSize(cdnPrefix, name)
            : null;
        modalSize.textContent = size != null ? formatFileSize(size) : "未知";
      } catch (e) {
        modalSize.textContent = "未知";
      }

      const tempImg = new Image();
      tempImg.onload = () => {
        if (modalDimensions) {
          modalDimensions.textContent = `${tempImg.naturalWidth} x ${tempImg.naturalHeight} px`;
        }
        if (modalLeft) modalLeft.classList.remove("is-loading");
        modalImg.style.opacity = "1";
      };
      tempImg.onerror = () => {
        if (modalLeft) modalLeft.classList.remove("is-loading");
        modalImg.style.opacity = "1";
      };
      tempImg.src = img.src;

    };
  });

  // 关闭 Modal
  if (modalClose) {
    modalClose.onclick = () => {
      modal.classList.add("hidden");
      modalImg.src = "";
      modalImg.style.opacity = "0";
      const modalLeft = modal.querySelector(".modal-left");
      if (modalLeft) modalLeft.classList.remove("is-loading");
    };
  }

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
      modalImg.src = "";
      modalImg.style.opacity = "0";
      const modalLeft = modal.querySelector(".modal-left");
      if (modalLeft) modalLeft.classList.remove("is-loading");
    }
  };
}

function updateDownloadProgress(done, total) {
  const wrapper = document.getElementById("download-progress");
  const bar = document.getElementById("progress-bar");
  const text = document.getElementById("progress-text");

  if (!wrapper) return;

  wrapper.classList.remove("hidden");

  const percent = Math.round((done / total) * 100);

  bar.style.width = `${percent}%`;
  text.textContent = `进度：${done} / ${total}`;
}

function showDownloadResult(success, failed, meta = {}) {
  const resultEl = document.getElementById("progress-result");
  if (!resultEl) return;

  const parts = [];
  if (failed > 0) {
    parts.push(`完成：成功 ${success} 个，失败 ${failed} 个`);
    if (meta.canResume) {
      parts.push("可点击「恢复下载」重试失败项");
    }
    resultEl.className = "error-text";
  } else {
    parts.push(`完成：共 ${success} 张图片`);
    resultEl.className = "success-text";
  }

  if (meta.partial) {
    parts.push("（已导出部分图片）");
  }

  if (meta.mode === "original") {
    parts.push("（原图模式）");
    if (meta.unresolved?.length) {
      parts.push(`未匹配 Files：${meta.unresolved.length} 个`);
    }
  }

  resultEl.textContent = parts.join(" ");
  updateResumeDownloadButton();
}
