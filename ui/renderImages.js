import { downloadImages } from "../utils/downloadImages.js";

export function renderImages(images, cdnPrefix) {
  const imagesEl = document.getElementById("images");
  if (!images || !imagesEl) return;

  imagesEl.classList.remove("hidden");

  if (images.length === 0) {
    imagesEl.innerHTML = `
      <h3>
        <span>🖼 Images</span>
        <span>0</span>
      </h3>
      <div class="empty-state">
        <div class="empty-icon">🖼️</div>
        <div class="empty-text">No Images Found</div>
        <div class="empty-subtext">This template does not appear to contain any image references.</div>
      </div>
    `;
    return;
  }

  imagesEl.innerHTML = `
    <h3>
      <span>🖼 Images</span>
      <span>${images.length}</span>
    </h3>

    <div class="image-grid">
      ${images
        .map((name) => {
          const src = cdnPrefix ? `${cdnPrefix}/${name}` : "";
          return `
            <div class="image-item">
              <div class="thumb">
                ${
                  src
                    ? `<img src="${src}" loading="lazy" data-name="${name}" class="preview-img"
                        onerror="this.style.display='none'" />`
                    : ""
                }
              </div>
              <div class="name">${name}</div>
            </div>
          `;
        })
        .join("")}
    </div>

    <button id="download">Download ZIP</button>

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

  // 下载按钮
  const downloadBtn = document.getElementById("download");
  if (downloadBtn) {
    downloadBtn.onclick = async () => {
      downloadBtn.disabled = true;
      downloadBtn.textContent = "Downloading…";

      await downloadImages(
        images,
        cdnPrefix,
        updateDownloadProgress,
        showDownloadResult,
      );

      downloadBtn.disabled = false;
      downloadBtn.textContent = "Download ZIP";
    };
  }

  // 图片预览 Modal
  setupImageModal();
}

function setupImageModal() {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImg");
  const modalName = document.getElementById("modalName");
  const modalSize = document.getElementById("modalSize");
  const modalUrl = document.getElementById("modalUrl");
  const modalDimensions = document.getElementById("modalDimensions");
  const modalClose = document.getElementById("modalClose");

  if (!modal || !modalImg) return;

  document.querySelectorAll(".preview-img").forEach(img => {
    img.onclick = async () => {
      modalName.textContent = img.dataset.name || "";
      modalSize.textContent = "Loading…";
      if (modalDimensions) modalDimensions.textContent = "Loading…";
      modalUrl.innerHTML = `<a href="${img.src}" target="_blank" rel="noopener noreferrer">${img.src}</a>`;

      modal.classList.remove("hidden");

      const modalLeft = modal.querySelector(".modal-left");
      if (modalLeft) modalLeft.classList.add("is-loading");
      modalImg.style.opacity = "0";
      modalImg.src = img.src;

      try {
        const res = await fetch(img.src);
        const blob = await res.blob();
        modalSize.textContent = `${(blob.size / 1024).toFixed(1)} KB`;
      } catch (e) {
        modalSize.textContent = "Unknown";
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
  text.textContent = `Progress: ${done} / ${total}`;
}

function showDownloadResult(success, failed) {
  const resultEl = document.getElementById("progress-result");
  if (!resultEl) return;

  if (failed > 0) {
    resultEl.textContent = `Finished: ${success} success, ${failed} failed`;
    resultEl.className = "error-text";
  } else {
    resultEl.textContent = `Finished: ${success} images`;
    resultEl.className = "success-text";
  }
}
