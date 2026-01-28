export function initJsonBubble() {
  const sectionsEl = document.getElementById("sections");
  const jsonBubble = document.getElementById("jsonBubble");
  
  if (!sectionsEl || !jsonBubble) return;

  sectionsEl.addEventListener("click", (e) => {
    // Find closest .tree-node
    const nodeEl = e.target.closest(".tree-node");
    if (!nodeEl) return;

    const jsonStr = nodeEl.dataset.json;
    if (!jsonStr) return;

    e.stopPropagation(); // Prevent closing immediately

    try {
      const json = JSON.parse(jsonStr);
      showJsonBubble(json, e.clientX, e.clientY, jsonBubble);
    } catch (err) {
      console.error("Invalid JSON data", err);
    }
  });

  // Close bubble when clicking outside
  document.addEventListener("click", (e) => {
    if (jsonBubble && !jsonBubble.contains(e.target)) {
      jsonBubble.classList.add("hidden");
    }
  });
}

function showJsonBubble(json, x, y, jsonBubble) {
  const pre = jsonBubble.querySelector("pre");
  pre.innerHTML = highlightJson(json);
  
  jsonBubble.classList.remove("hidden");
  
  // Get actual dimensions
  const rect = jsonBubble.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const gap = 10;

  let left = x + gap;
  let top = y + gap;

  // Flip horizontally if overlaps right edge
  if (left + width > viewportWidth - gap) {
    left = x - width - gap;
  }
  
  // Flip vertically if overlaps bottom edge
  if (top + height > viewportHeight - gap) {
    top = y - height - gap;
  }
  
  // Constrain to viewport
  if (left < gap) left = gap;
  if (top < gap) top = gap;
  
  // If still overflowing right/bottom (e.g. huge bubble), CSS max-width/height handles it,
  // but we might need to adjust left/top to fit as much as possible.
  if (left + width > viewportWidth) {
      left = viewportWidth - width - gap;
  }
  if (top + height > viewportHeight) {
      top = viewportHeight - height - gap;
  }

  jsonBubble.style.left = `${left}px`;
  jsonBubble.style.top = `${top}px`;
}

function highlightJson(obj) {
  const lines = JSON.stringify(obj, null, 2).split("\n");
  return lines
    .map((line) => highlightLine(line))
    .join("\n");
}

function highlightLine(line) {
  const keyMatch = line.match(/^(\s*)"([^"]+)"\s*:\s*(.*)$/);
  if (keyMatch) {
    const indent = keyMatch[1];
    const key = keyMatch[2];
    const rest = keyMatch[3];
    return (
      escapeHtml(indent) +
      `<span class="json-key">"` +
      escapeHtml(key) +
      `"</span>: ` +
      highlightValue(rest)
    );
  }
  return highlightStructural(line);
}

function highlightValue(raw) {
  const trimmed = raw.trim();
  const hasComma = trimmed.endsWith(",");
  const core = hasComma ? trimmed.slice(0, -1) : trimmed;
  let rendered = "";
  if (/^".*"$/.test(core)) {
    rendered = `<span class="json-string">` + escapeHtml(core) + `</span>`;
  } else if (/^-?\d+(\.\d+)?([eE][+\-]?\d+)?$/.test(core)) {
    rendered = `<span class="json-number">` + escapeHtml(core) + `</span>`;
  } else if (/^(true|false)$/.test(core)) {
    rendered = `<span class="json-boolean">` + escapeHtml(core) + `</span>`;
  } else if (/^null$/.test(core)) {
    rendered = `<span class="json-null">` + escapeHtml(core) + `</span>`;
  } else {
    rendered = highlightStructural(core);
  }
  return rendered + (hasComma ? `<span class="json-comma">,</span>` : "");
}

function highlightStructural(line) {
  const escaped = escapeHtml(line);
  return escaped
    .replace(/([{}\[\]])/g, `<span class="json-brace">$1</span>`)
    .replace(/(:)/g, `<span class="json-colon">$1</span>`)
    .replace(/(,)/g, `<span class="json-comma">$1</span>`);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
