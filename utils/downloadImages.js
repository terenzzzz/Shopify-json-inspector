/**
 * 批量下载图片并打包成 ZIP（前端版）
 *
 * - CDN 模式：走店铺 CDN，适合预览，文件会被 Shopify 优化/重编码。
 * - 原图模式：经本地 Admin 代理查询 originalSource，下载 GCS 签名原图（与后台下载一致）。
 * - 支持失败恢复：已成功的图片会缓存在内存中，可点击「恢复下载」重试失败项。
 *
 * @param {string[]} images - 图片文件名数组
 * @param {string} cdnPrefix - CDN 前缀
 * @param {string} zipBaseName - 压缩包基础文件名（不含 .zip）
 * @param {Function} onProgress
 * @param {Function} onFinish
 * @param {{ mode?: 'cdn'|'original', admin?: { proxyUrl?: string, shop?: string, token?: string } }} [options]
 */
import { showModal } from './showModal.js';
import { isAdminProxyAvailable, resolveOriginalSources } from './shopifyAdmin.js';

/** Shopify CDN 允许的最大边长，超过原图尺寸时不会放大 */
const SHOPIFY_MAX_IMAGE_WIDTH = 5760;
const DEFAULT_PROXY_URL = 'http://127.0.0.1:3456';

/** @type {DownloadSession | null} */
let currentDownloadSession = null;

/**
 * @typedef {object} DownloadSession
 * @property {string[]} images
 * @property {string} cdnPrefix
 * @property {string} zipBaseName
 * @property {object} options
 * @property {Map<string, { fileName: string, blob: Blob }>} completed
 * @property {string[]} pending
 * @property {Map<string, { url: string }>} originalSources
 * @property {string[]} unresolved
 */

export function canResumeDownload() {
  return Boolean(currentDownloadSession?.pending?.length);
}

export function clearDownloadSession() {
  currentDownloadSession = null;
}

export async function resumeDownloadImages(onProgress, onFinish) {
  if (!canResumeDownload()) return false;
  await runDownloadSession(currentDownloadSession, onProgress, onFinish);
  return true;
}

export async function downloadImages(
  images,
  cdnPrefix,
  zipBaseName,
  onProgress,
  onFinish,
  options = {}
) {
  clearDownloadSession();
  currentDownloadSession = createDownloadSession(images, cdnPrefix, zipBaseName, options);
  await runDownloadSession(currentDownloadSession, onProgress, onFinish);
}

/** 与 CDN 下载使用相同 URL 策略获取图片，保证展示大小与 ZIP 内文件一致 */
export async function fetchDownloadImageSize(cdnPrefix, rawName) {
  if (!cdnPrefix) return null;

  try {
    const blob = await fetchDownloadImageBlob(cdnPrefix, rawName);
    return blob.size;
  } catch {
    return null;
  }
}

export async function fetchDownloadImageBlob(cdnPrefix, rawName) {
  const prefix = normalizeCdnPrefix(cdnPrefix);
  const name = normalizeImageName(rawName);
  const expectedMime = mimeForExt(getExtFromFilename(name));
  const accept = buildAcceptForName(name);
  return fetchBestQualityBlob(prefix, name, accept, expectedMime);
}

function createDownloadSession(images, cdnPrefix, zipBaseName, options) {
  return {
    images: [...images],
    cdnPrefix,
    zipBaseName,
    options: { ...options },
    completed: new Map(),
    pending: images.map(normalizeImageName),
    originalSources: new Map(),
    unresolved: [],
  };
}

async function runDownloadSession(session, onProgress, onFinish) {
  const mode = session.options.mode === 'original' ? 'original' : 'cdn';

  if (mode === 'original') {
    const ready = await ensureOriginalDownloadReady(session);
    if (!ready) return;
    await resolvePendingOriginalSources(session, onProgress);
  } else if (!session.cdnPrefix) {
    showModal('请先填写 CDN Prefix');
    return;
  }

  const pending = [...session.pending];
  const retryablePending = pending.filter((name) => !session.unresolved.includes(name));

  for (const name of retryablePending) {
    try {
      const entry =
        mode === 'original'
          ? await fetchOriginalImageEntry(session, name)
          : await fetchCdnImageEntry(session, name);
      session.completed.set(name, entry);
      session.pending = session.pending.filter((item) => item !== name);
    } catch (error) {
      console.warn('❌ 图片下载失败:', name, error);
    } finally {
      onProgress?.(session.images.length - session.pending.length, session.images.length);
    }
  }

  const success = session.completed.size;
  const failed = session.pending.length;
  const canRetry = session.pending.some((name) => !session.unresolved.includes(name));

  if (failed === 0) {
    const zip = buildZipFromSession(session);
    await saveZip(zip, session.zipBaseName);
    clearDownloadSession();
    onFinish?.(success, 0, { mode, canResume: false });
    return;
  }

  if (!canRetry && success > 0) {
    const zip = buildZipFromSession(session);
    await saveZip(zip, session.zipBaseName);
    clearDownloadSession();
    onFinish?.(success, failed, {
      mode,
      canResume: false,
      partial: true,
      unresolved: [...session.unresolved],
    });
    return;
  }

  onFinish?.(success, failed, {
    mode,
    canResume: canRetry,
    failedNames: [...session.pending],
    unresolved: [...session.unresolved],
  });
}

async function ensureOriginalDownloadReady(session) {
  const admin = session.options.admin || {};

  if (!admin.shop || !admin.token) {
    showModal('原图下载需要填写店铺域名和 Admin Token');
    return false;
  }

  const proxyUrl = admin.proxyUrl || DEFAULT_PROXY_URL;
  const proxyReady = await isAdminProxyAvailable(proxyUrl);
  if (!proxyReady) {
    showModal(
      '未检测到本地 Admin 代理。请先在项目目录运行：\nnode server/admin-proxy.mjs'
    );
    return false;
  }

  return true;
}

async function resolvePendingOriginalSources(session, onProgress) {
  const admin = session.options.admin || {};
  const proxyUrl = admin.proxyUrl || DEFAULT_PROXY_URL;
  const toResolve = session.pending.filter((name) => !session.originalSources.has(name));
  if (!toResolve.length) return;

  const originals = await resolveOriginalSources({
    proxyUrl,
    shop: admin.shop,
    token: admin.token,
    filenames: toResolve,
    onProgress: (done, total) => {
      onProgress?.(session.completed.size + done, session.images.length + total);
    },
  });

  for (const name of toResolve) {
    const source = originals.get(name);
    if (source?.url) {
      session.originalSources.set(name, source);
      continue;
    }

    if (!session.unresolved.includes(name)) {
      session.unresolved.push(name);
    }
  }
}

async function fetchCdnImageEntry(session, name) {
  const cdnPrefix = normalizeCdnPrefix(session.cdnPrefix);
  const expectedMime = mimeForExt(getExtFromFilename(name));
  const accept = buildAcceptForName(name);
  const blob = await fetchBestQualityBlob(cdnPrefix, name, accept, expectedMime);

  return {
    fileName: keepOriginalOrAddExt(name, blob.type),
    blob,
  };
}

async function fetchOriginalImageEntry(session, name) {
  if (session.unresolved.includes(name)) {
    throw new Error('original source not found');
  }

  const source = session.originalSources.get(name);
  if (!source?.url) {
    throw new Error('original source missing');
  }

  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();

  return {
    fileName: name,
    blob,
  };
}

function buildZipFromSession(session) {
  const zip = new JSZip();
  const folder = zip.folder(normalizeZipBaseName(session.zipBaseName));

  for (const rawName of session.images) {
    const name = normalizeImageName(rawName);
    const entry = session.completed.get(name);
    if (entry) {
      folder.file(entry.fileName, entry.blob);
    }
  }

  return zip;
}

async function saveZip(zip, zipBaseName) {
  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  const filename = `${normalizeZipBaseName(zipBaseName)}.zip`;
  link.href = URL.createObjectURL(content);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function normalizeZipBaseName(zipBaseName) {
  const name = String(zipBaseName || 'shopify-images').replace(/\.zip$/i, '').trim();
  return name || 'shopify-images';
}

function normalizeImageName(rawName) {
  return String(rawName)
    .replace(/^shopify:\/\/shop_images\//, '')
    .split('?')[0]
    .replace(/^\/+/, '');
}

/** 构建尽量接近原图质量的 CDN 下载 URL（仍非后台原图） */
export function buildDownloadUrl(cdnPrefix, name) {
  const baseUrl = `${cdnPrefix}${encodePathSegment(name)}`;
  const format = extToFormat(getExtFromFilename(name));
  const params = new URLSearchParams();
  params.set('width', String(SHOPIFY_MAX_IMAGE_WIDTH));
  if (format) params.set('format', format);
  return `${baseUrl}?${params.toString()}`;
}

function encodePathSegment(filename) {
  return filename.split('/').map(encodeURIComponent).join('/');
}

async function fetchBestQualityBlob(cdnPrefix, name, accept, expectedMime) {
  const urls = buildDownloadUrlCandidates(cdnPrefix, name);
  let bestBlob = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: accept,
          'Cache-Control': 'no-transform',
        },
      });
      if (!res.ok) continue;

      const blob = await res.blob();
      if (!bestBlob || isBetterBlob(blob, bestBlob, expectedMime)) {
        bestBlob = blob;
      }

      if (expectedMime && blob.type === expectedMime) {
        return blob;
      }
    } catch {}
  }

  if (!bestBlob) throw new Error('fetch failed');
  return bestBlob;
}

/** 优先带 width/format 的 URL，再回退到无参数直链 */
function buildDownloadUrlCandidates(cdnPrefix, name) {
  const encoded = encodePathSegment(name);
  const baseUrl = `${cdnPrefix}${encoded}`;
  const format = extToFormat(getExtFromFilename(name));
  const urls = [buildDownloadUrl(cdnPrefix, name)];

  if (format) {
    const params = new URLSearchParams({ width: String(SHOPIFY_MAX_IMAGE_WIDTH) });
    urls.push(`${baseUrl}?${params.toString()}`);
    urls.push(
      baseUrl.includes('?')
        ? `${baseUrl}&format=${format}`
        : `${baseUrl}?format=${format}`
    );
  }

  urls.push(baseUrl);
  return [...new Set(urls)];
}

function isBetterBlob(candidate, current, expectedMime) {
  if (expectedMime) {
    const candidateMatch = candidate.type === expectedMime;
    const currentMatch = current.type === expectedMime;
    if (candidateMatch !== currentMatch) return candidateMatch;
  }
  return candidate.size > current.size;
}

function normalizeCdnPrefix(prefix) {
  if (!prefix) return '';

  prefix = prefix.replace(/\/+$/, '');

  if (!prefix.endsWith('/files')) {
    prefix += '/files';
  }

  return prefix + '/';
}

function getExtFromFilename(filename) {
  const i = filename.lastIndexOf('.');
  if (i === -1) return '';
  return filename.slice(i).toLowerCase();
}

function mimeForExt(ext) {
  switch (ext) {
    case '.webp':
      return 'image/webp';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    default:
      return '';
  }
}

function buildAcceptForName(filename) {
  const mime = mimeForExt(getExtFromFilename(filename));
  if (mime) return `${mime};q=1.0, image/*;q=0.01`;
  return 'image/*';
}

function keepOriginalOrAddExt(filename, mime) {
  const ext = getExtFromFilename(filename);
  if (ext) return filename;
  const add = getExtFromMime(mime);
  if (!add) return filename;
  return filename + add;
}

function getExtFromMime(mime) {
  switch (mime) {
    case 'image/webp':
      return '.webp';
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/gif':
      return '.gif';
    default:
      return '';
  }
}

function extToFormat(ext) {
  switch (ext) {
    case '.webp': return 'webp';
    case '.jpg':
    case '.jpeg': return 'jpg';
    case '.png': return 'png';
    case '.gif': return 'gif';
    default: return '';
  }
}
