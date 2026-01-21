/**
 * 批量下载图片并打包成 ZIP（前端版）
 *
 * @param {string[]} images - 图片文件名数组
 * @param {string} cdnPrefix - CDN 前缀
 */
export async function downloadImages(
  images,
  cdnPrefix,
  onProgress,
  onFinish
) {
  if (!cdnPrefix) {
    alert('请先填写 CDN Prefix');
    return;
  }

  cdnPrefix = normalizeCdnPrefix(cdnPrefix);

  const zip = new JSZip();
  const folder = zip.folder('images');

  let done = 0;
  let success = 0;
  let failed = 0;
  const total = images.length;

  for (const rawName of images) {
    let name = rawName
      .replace(/^shopify:\/\/shop_images\//, '')
      .split('?')[0]
      .replace(/^\/+/, '');

    const url = `${cdnPrefix}/${encodeURIComponent(name)}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);

      const blob = await res.blob();
      folder.file(name, blob);
      success++;
    } catch (e) {
      console.warn('❌ 下载失败:', url);
      failed++;
    } finally {
      done++;
      onProgress?.(done, total);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = 'shopify-images.zip';
  link.click();

  URL.revokeObjectURL(link.href);

  onFinish?.(success, failed);
}



function normalizeCdnPrefix(prefix) {
  if (!prefix) return '';

  // 去掉末尾所有 /
  prefix = prefix.replace(/\/+$/, '');

  // 如果结尾不是 /files，则补上
  if (!prefix.endsWith('/files')) {
    prefix += '/files';
  }

  return prefix + '/';
}
