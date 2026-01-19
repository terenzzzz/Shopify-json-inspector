/**
 * 批量下载图片并打包成 ZIP（前端版）
 *
 * @param {string[]} images - 图片文件名数组
 * @param {string} cdnPrefix - CDN 前缀
 */
export async function downloadImages(images, cdnPrefix) {
  if (!cdnPrefix) {
    alert('请先填写 CDN Prefix');
    return;
  }

  const zip = new JSZip();
  const folder = zip.folder('images');

  for (const name of images) {
    const url = cdnPrefix + name;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);

      const blob = await res.blob();
      folder.file(name, blob);
    } catch (e) {
      console.warn('❌ 下载失败:', name);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');

  link.href = URL.createObjectURL(content);
  link.download = 'shopify-images.zip';
  link.click();

  URL.revokeObjectURL(link.href);
}
