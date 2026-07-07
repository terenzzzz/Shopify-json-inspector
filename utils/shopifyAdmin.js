const DEFAULT_PROXY_URL = 'http://127.0.0.1:3456';
const FILES_PAGE_SIZE = 50;

const RESOLVE_ORIGINALS_QUERY = `
  query ResolveOriginalFiles($query: String!) {
    files(first: 5, query: $query) {
      nodes {
        ... on MediaImage {
          id
          mimeType
          image {
            url
          }
          originalSource {
            url
            fileSize
          }
        }
      }
    }
  }
`;

export function normalizeShopDomain(shop) {
  let value = String(shop || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!value) return '';
  if (!value.includes('.')) value += '.myshopify.com';
  return value;
}

export async function isAdminProxyAvailable(proxyUrl = DEFAULT_PROXY_URL) {
  try {
    const res = await fetch(`${proxyUrl}/health`, { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.ok);
  } catch {
    return false;
  }
}

export async function adminGraphql({ proxyUrl, shop, token, query, variables }) {
  const res = await fetch(`${proxyUrl}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shop: normalizeShopDomain(shop),
      token,
      query,
      variables,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `Admin proxy HTTP ${res.status}`);
  }
  if (payload?.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).join('; '));
  }
  return payload.data;
}

function basenameFromUrl(url) {
  if (!url) return '';
  const clean = String(url).split('?')[0];
  const parts = clean.split('/');
  return decodeURIComponent(parts[parts.length - 1] || '');
}

function buildFilenameQuery(filename) {
  const escaped = String(filename).replace(/"/g, '\\"');
  return `filename:"${escaped}"`;
}

function pickBestNode(nodes, filename) {
  if (!nodes?.length) return null;

  const exact = nodes.find((node) => {
    const fromImageUrl = basenameFromUrl(node?.image?.url);
    return fromImageUrl === filename;
  });
  if (exact?.originalSource?.url) return exact;

  const withOriginal = nodes.find((node) => node?.originalSource?.url);
  return withOriginal || nodes[0];
}

export async function resolveOriginalSources({
  proxyUrl = DEFAULT_PROXY_URL,
  shop,
  token,
  filenames,
  onProgress,
}) {
  const uniqueNames = [...new Set(filenames.map((name) => String(name).trim()).filter(Boolean))];
  const resolved = new Map();
  let done = 0;

  for (let i = 0; i < uniqueNames.length; i += FILES_PAGE_SIZE) {
    const batch = uniqueNames.slice(i, i + FILES_PAGE_SIZE);

    await Promise.all(
      batch.map(async (filename) => {
        try {
          const data = await adminGraphql({
            proxyUrl,
            shop,
            token,
            query: RESOLVE_ORIGINALS_QUERY,
            variables: { query: buildFilenameQuery(filename) },
          });

          const node = pickBestNode(data?.files?.nodes, filename);
          const originalUrl = node?.originalSource?.url;
          if (!originalUrl) return;

          resolved.set(filename, {
            url: originalUrl,
            fileSize: node.originalSource.fileSize ?? null,
            mimeType: node.mimeType || null,
          });
        } catch (error) {
          console.warn('原图解析失败:', filename, error);
        } finally {
          done += 1;
          onProgress?.(done, uniqueNames.length);
        }
      })
    );
  }

  return resolved;
}
