export function renderTreeNode(node) {
  const hasChildren = node.children && node.children.length > 0;
  
  const className = [
    "tree-node",
    "tree-content",
    node.disabled ? "is-disabled" : "",
    node.nodeType ? `is-${node.nodeType}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  const dataAttr = node.data
    ? ` data-json="${escapeHtml(JSON.stringify(node.data))}"`
    : "";

  const toggleHtml = hasChildren
    ? `<span class="tree-toggle">▶</span>`
    : `<span class="tree-toggle placeholder"></span>`;

  const labelHtml = `<span class="tree-label">${node.label}</span>`;
  const metaHtml = node.meta
    ? `<span class="tree-meta"> (${node.meta})</span>`
    : "";

  let childrenHtml = "";
  if (hasChildren) {
    const childrenItems = node.children
      .map((child) => renderTreeNode(child))
      .join("");
    childrenHtml = `<ul class="tree-children hidden">${childrenItems}</ul>`;
  }

  return `
    <li class="tree-item">
      <div class="${className}"${dataAttr}>
        ${toggleHtml}
        ${labelHtml}${metaHtml}
      </div>
      ${childrenHtml}
    </li>
  `;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
