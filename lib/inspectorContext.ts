import type { SelectedElement } from "./previewInspector";

export function formatSelectedElement(
  sel: SelectedElement,
  userMessage: string,
): string {
  const attrs: string[] = [
    `selector="${escapeAttr(sel.selector)}"`,
    `tag="${escapeAttr(sel.tag)}"`,
  ];
  if (sel.id) attrs.push(`id="${escapeAttr(sel.id)}"`);
  if (sel.classList.length)
    attrs.push(`classes="${escapeAttr(sel.classList.join(" "))}"`);

  const cssLines = Object.entries(sel.css)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  return [
    `<selected_element ${attrs.join(" ")}>`,
    `<html>${sel.html}</html>`,
    cssLines ? `<computed_css>\n${cssLines}\n</computed_css>` : "<computed_css/>",
    `</selected_element>`,
    `<user_request>${userMessage}</user_request>`,
  ].join("\n");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/[<>]/g, (c) =>
    c === "<" ? "&lt;" : "&gt;",
  );
}
