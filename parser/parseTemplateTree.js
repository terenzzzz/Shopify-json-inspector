// server/parser/parseTemplateTree.js

export function parseTemplateTree(templateJson, filename = "template.json") {
  const sectionsMap = templateJson.sections || {};
  const order = Array.isArray(templateJson.order)
    ? templateJson.order
    : Object.keys(sectionsMap);

  return {
    label: filename,
    children: order
      .map((sectionId) => {
        const section = sectionsMap[sectionId];
        if (!section) return null;

        const blocks = section.blocks || {};

        return {
          label: sectionId,
          nodeType: "section",
          disabled: section.disabled === true,
          meta: [section.type]
            .filter(Boolean)
            .join(" · "),
          data: section,
          children: Object.values(blocks).map((block) => ({
            label: block.type || "unknown",
            nodeType: "block",
            disabled: block.disabled === true,
            data: block,
          })),
        };
      })
      .filter(Boolean),
  };
}
