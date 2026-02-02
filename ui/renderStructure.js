import { renderTreeNode } from "../utils/renderTreeNode.js";

export function renderStructure(tree) {
  const el = document.getElementById("structure");
  if (!el) return;

  if (!tree || (Array.isArray(tree) && tree.length === 0) || (typeof tree === "object" && Object.keys(tree).length === 0)) {
    el.innerHTML = `
      <div class="empty-state is-embedded">
        <div class="empty-icon">🌳</div>
        <div class="empty-text">No Structure Found</div>
      </div>
    `;
    return;
  }

  const treeHtml = renderTreeNode(tree);

  el.innerHTML = `
    <div class="tree-toolbar">
      <button id="expandAll" class="text-btn">Expand All</button>
      <button id="collapseAll" class="text-btn">Collapse All</button>
    </div>
    <ul class="structure-tree tree-root">${treeHtml}</ul>
  `;

  // Toolbar events
  el.querySelector("#expandAll").onclick = () => {
    el.querySelectorAll(".tree-children").forEach((ul) => ul.classList.remove("hidden"));
    el.querySelectorAll(".tree-toggle").forEach((t) => {
      if (!t.classList.contains("placeholder")) {
        t.classList.add("is-open");
        t.textContent = "▼";
      }
    });
  };

  el.querySelector("#collapseAll").onclick = () => {
    el.querySelectorAll(".tree-children").forEach((ul) => ul.classList.add("hidden"));
    el.querySelectorAll(".tree-toggle").forEach((t) => {
      if (!t.classList.contains("placeholder")) {
        t.classList.remove("is-open");
        t.textContent = "▶";
      }
    });
    // Keep root expanded
    const rootChildren = el.querySelector(".tree-root > .tree-item > .tree-children");
    const rootToggle = el.querySelector(".tree-root > .tree-item > .tree-content > .tree-toggle");
    if (rootChildren) rootChildren.classList.remove("hidden");
    if (rootToggle) {
      rootToggle.classList.add("is-open");
      rootToggle.textContent = "▼";
    }
  };

  // Add event listeners for toggles
  el.querySelectorAll(".tree-toggle").forEach((toggle) => {
    if (toggle.classList.contains("placeholder")) return;

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const item = toggle.closest(".tree-item");
      const children = item.querySelector(".tree-children");
      if (children) {
        const isHidden = children.classList.toggle("hidden");
        toggle.classList.toggle("is-open", !isHidden);
        toggle.textContent = isHidden ? "▶" : "▼";
      }
    });
  });

  // Expand the root node by default
  const rootItem = el.querySelector(".tree-root > .tree-item");
  if (rootItem) {
    const rootChildren = rootItem.querySelector(".tree-children");
    const rootToggle = rootItem.querySelector(".tree-toggle");
    
    if (rootChildren) rootChildren.classList.remove("hidden");
    if (rootToggle && !rootToggle.classList.contains("placeholder")) {
      rootToggle.classList.add("is-open");
      rootToggle.textContent = "▼";
    }
  }
}
