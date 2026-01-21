let modalMask;
let modalMessage;
let modalConfirm;

/**
 * 初始化 modal（只需调用一次）
 */
export function initModal() {
  modalMask = document.getElementById('modal-mask');
  modalMessage = document.getElementById('modal-message');
  modalConfirm = document.getElementById('modal-confirm');

  if (!modalMask || !modalMessage || !modalConfirm) {
    console.warn('[Modal] DOM not found');
    return;
  }

  modalConfirm.addEventListener('click', hideModal);
}

/**
 * 显示 modal
 */
export function showModal(message) {
  if (!modalMask) {
    console.warn('[Modal] call initModal() first');
    return;
  }

  modalMessage.textContent = message;
  modalMask.classList.remove('hidden');
}

/**
 * 隐藏 modal
 */
export function hideModal() {
  modalMask.classList.add('hidden');
}
