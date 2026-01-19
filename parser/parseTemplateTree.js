// server/parser/parseTemplateTree.js

export function parseTemplateTree(templateJson, filename = 'template.json') {
  const sectionsMap = templateJson.sections || {};
  const order = Array.isArray(templateJson.order)
    ? templateJson.order
    : Object.keys(sectionsMap);

  return {
    label: filename,
    children: order
      .map(sectionId => {
        const section = sectionsMap[sectionId];
        if (!section) return null;

        const blocks = section.blocks || {};

        return {
          label: sectionId,
          meta: [
            section.type,
            section.disabled ? 'disabled' : null
          ]
            .filter(Boolean)
            .join(' · '),
          children: Object.values(blocks).map(block => ({
            label: block.type || 'unknown'
          }))
        };
      })
      .filter(Boolean)
  };
}
