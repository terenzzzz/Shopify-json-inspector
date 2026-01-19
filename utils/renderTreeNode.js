// server/utils/renderTree.js

export function renderTreeNode(node, prefix = '', isLast = true) {
  const lines = [];

  const connector = prefix
    ? isLast
      ? '└─ '
      : '├─ '
    : '';

  const meta = node.meta ? ` (${node.meta})` : '';
  lines.push(`${prefix}${connector}${node.label}${meta}`);

  if (node.children && node.children.length) {
    const nextPrefix = prefix + (isLast ? '   ' : '│  ');

    node.children.forEach((child, index) => {
      const last = index === node.children.length - 1;
      lines.push(renderTreeNode(child, nextPrefix, last));
    });
  }

  return lines.join('\n');
}
