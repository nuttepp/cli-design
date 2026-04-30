export type SelectedElement = {
  selector: string;
  tag: string;
  id: string | null;
  classList: string[];
  text: string;
  html: string;
  css: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
};

export type RuntimeError = {
  kind: "exception" | "resource" | "rejection";
  message: string;
  stack?: string | null;
  source?: string | null;
  line?: number | null;
  col?: number | null;
};

export type InspectorMessage =
  | { __sandpack_inspector__: true; type: "activate" }
  | { __sandpack_inspector__: true; type: "deactivate" }
  | { __sandpack_inspector__: true; type: "select"; payload: SelectedElement }
  | {
      __sandpack_inspector__: true;
      type: "runtime_error";
      payload: RuntimeError;
    }
  | {
      __sandpack_inspector__: true;
      type: "apply_style";
      selector: string;
      css: Record<string, string>;
    }
  | {
      __sandpack_inspector__: true;
      type: "clear_styles";
      selector: string;
    };

const HTML_CAP = 800;
const TEXT_CAP = 200;
const SELECTOR_DEPTH = 4;

const CSS_ALLOWLIST = [
  "color",
  "background-color",
  "background-image",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-align",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-radius",
  "display",
  "flex-direction",
  "justify-content",
  "align-items",
  "gap",
  "grid-template-columns",
  "grid-template-rows",
  "width",
  "height",
  "min-width",
  "max-width",
  "opacity",
  "box-shadow",
  "transform",
];

const CSS_DEFAULTS: Record<string, string[]> = {
  "background-image": ["none"],
  "border-top-width": ["0px"],
  "border-right-width": ["0px"],
  "border-bottom-width": ["0px"],
  "border-left-width": ["0px"],
  "border-top-style": ["none"],
  "border-right-style": ["none"],
  "border-bottom-style": ["none"],
  "border-left-style": ["none"],
  "border-radius": ["0px"],
  "padding-top": ["0px"],
  "padding-right": ["0px"],
  "padding-bottom": ["0px"],
  "padding-left": ["0px"],
  "margin-top": ["0px"],
  "margin-right": ["0px"],
  "margin-bottom": ["0px"],
  "margin-left": ["0px"],
  gap: ["normal", "0px"],
  "grid-template-columns": ["none"],
  "grid-template-rows": ["none"],
  "min-width": ["auto", "0px"],
  "max-width": ["none"],
  opacity: ["1"],
  "box-shadow": ["none"],
  transform: ["none"],
  "letter-spacing": ["normal"],
  "text-align": ["start"],
};

export const INSPECTOR_MARKER = "__sandpack_inspector__";

export const INSPECTOR_SCRIPT = `(function(){
  if (window.${INSPECTOR_MARKER}) return;
  window.${INSPECTOR_MARKER} = true;

  var ALLOW = ${JSON.stringify(CSS_ALLOWLIST)};
  var DEFAULTS = ${JSON.stringify(CSS_DEFAULTS)};
  var SELECTOR_DEPTH = ${SELECTOR_DEPTH};
  var HTML_CAP = ${HTML_CAP};
  var TEXT_CAP = ${TEXT_CAP};

  var active = false;
  var hovered = null;
  var prevCursor = "";
  var overlay = document.createElement("div");
  overlay.setAttribute("data-sandpack-inspector-overlay", "1");
  overlay.style.cssText = [
    "position:fixed",
    "pointer-events:none",
    "border:2px solid #6366f1",
    "background:rgba(99,102,241,0.10)",
    "z-index:2147483647",
    "display:none",
    "transition:all 80ms ease-out",
    "box-sizing:border-box",
  ].join(";");

  function ensureOverlay(){
    if (!overlay.isConnected && document.body) document.body.appendChild(overlay);
  }

  function moveOverlay(el){
    var r = el.getBoundingClientRect();
    overlay.style.display = "block";
    overlay.style.left = r.left + "px";
    overlay.style.top = r.top + "px";
    overlay.style.width = r.width + "px";
    overlay.style.height = r.height + "px";
  }

  function hideOverlay(){
    overlay.style.display = "none";
  }

  function activate(on){
    active = !!on;
    if (active){
      ensureOverlay();
      prevCursor = document.body.style.cursor || "";
      document.body.style.cursor = "crosshair";
    } else {
      hideOverlay();
      document.body.style.cursor = prevCursor;
      hovered = null;
    }
  }

  function escapeIdent(s){
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&");
  }

  function elSelector(el){
    if (!(el instanceof Element)) return "";
    if (el.id) return "#" + escapeIdent(el.id);
    var tag = el.tagName.toLowerCase();
    var classes = (el.getAttribute("class") || "").trim().split(/\\s+/).filter(Boolean).slice(0, 3);
    if (classes.length) return tag + "." + classes.map(escapeIdent).join(".");
    var parent = el.parentElement;
    if (!parent) return tag;
    var sameTag = Array.prototype.filter.call(parent.children, function(c){ return c.tagName === el.tagName; });
    if (sameTag.length === 1) return tag;
    var idx = sameTag.indexOf(el) + 1;
    return tag + ":nth-of-type(" + idx + ")";
  }

  function pathSelector(el){
    var parts = [];
    var cur = el;
    var depth = 0;
    while (cur && cur.nodeType === 1 && cur !== document.body && depth < SELECTOR_DEPTH){
      parts.unshift(elSelector(cur));
      if (cur.id) break;
      cur = cur.parentElement;
      depth++;
    }
    return parts.join(" > ");
  }

  function isDefault(prop, value){
    var d = DEFAULTS[prop];
    if (!d) return false;
    for (var i=0;i<d.length;i++) if (d[i] === value) return true;
    return false;
  }

  function collectCss(el){
    var cs = getComputedStyle(el);
    var out = {};
    for (var i=0;i<ALLOW.length;i++){
      var p = ALLOW[i];
      var v = cs.getPropertyValue(p);
      if (v == null) continue;
      v = String(v).trim();
      if (!v) continue;
      if (isDefault(p, v)) continue;
      out[p] = v;
    }
    return out;
  }

  function capHtml(el){
    var s = el.outerHTML || "";
    if (s.length <= HTML_CAP) return s;
    var truncated = s.length - HTML_CAP;
    return s.slice(0, HTML_CAP) + "\\u2026[truncated " + truncated + " chars]";
  }

  function capText(el){
    var t = (el.textContent || "").replace(/\\s+/g, " ").trim();
    if (t.length <= TEXT_CAP) return t;
    return t.slice(0, TEXT_CAP) + "\\u2026";
  }

  function buildPayload(el){
    var rect = el.getBoundingClientRect();
    var classList = [];
    if (el.classList){
      for (var i=0;i<el.classList.length;i++) classList.push(el.classList[i]);
    }
    return {
      selector: pathSelector(el),
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classList: classList,
      text: capText(el),
      html: capHtml(el),
      css: collectCss(el),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  }

  function isOverlay(el){
    return el && el.getAttribute && el.getAttribute("data-sandpack-inspector-overlay") === "1";
  }

  function pickTarget(e){
    var t = e.target;
    if (!(t instanceof Element)) return null;
    if (isOverlay(t)) return null;
    return t;
  }

  function onMove(e){
    if (!active) return;
    var t = pickTarget(e);
    if (!t) return;
    if (t === hovered) return;
    hovered = t;
    moveOverlay(t);
  }

  function onClick(e){
    if (!active) return;
    var t = pickTarget(e);
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    var payload = buildPayload(t);
    try {
      window.parent.postMessage({ ${JSON.stringify(INSPECTOR_MARKER)}: true, type: "select", payload: payload }, "*");
    } catch (_) {}
    activate(false);
  }

  function onSuppress(e){
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  document.addEventListener("mouseover", onMove, true);
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("pointerdown", onSuppress, true);
  document.addEventListener("mousedown", onSuppress, true);
  document.addEventListener("click", onClick, true);

  function reportError(info){
    try {
      window.parent.postMessage({ ${JSON.stringify(INSPECTOR_MARKER)}: true, type: "runtime_error", payload: info }, "*");
    } catch (_) {}
  }

  window.addEventListener("error", function(e){
    var t = e.target;
    if (t && t !== window && t.tagName) {
      var src = t.src || t.href || "";
      reportError({
        kind: "resource",
        message: "Failed to load " + String(t.tagName).toLowerCase() + (src ? ": " + src : ""),
        source: src || null,
      });
      return;
    }
    reportError({
      kind: "exception",
      message: e.message || "Uncaught error",
      stack: e.error && e.error.stack ? String(e.error.stack) : null,
      source: e.filename || null,
      line: typeof e.lineno === "number" ? e.lineno : null,
      col: typeof e.colno === "number" ? e.colno : null,
    });
  }, true);

  window.addEventListener("unhandledrejection", function(e){
    var r = e.reason;
    var msg = "Unhandled promise rejection";
    if (r && typeof r === "object" && r.message) msg = String(r.message);
    else if (r != null) msg = String(r);
    reportError({
      kind: "rejection",
      message: msg,
      stack: r && r.stack ? String(r.stack) : null,
    });
  });

  // Tracks inline-style props this script has applied per selector, so we can
  // remove props that are no longer in the latest override map (revert to the
  // stylesheet value) without nuking unrelated inline styles the page set.
  var appliedProps = Object.create(null);

  function findTargets(selector){
    if (!selector) return [];
    try { return Array.prototype.slice.call(document.querySelectorAll(selector)); }
    catch (_) { return []; }
  }

  function applyStyles(selector, css){
    var targets = findTargets(selector);
    if (!targets.length) return;
    var prev = appliedProps[selector] || {};
    var next = {};
    for (var prop in css){
      if (!Object.prototype.hasOwnProperty.call(css, prop)) continue;
      var value = css[prop];
      if (value == null || value === "") continue;
      next[prop] = true;
      for (var i=0;i<targets.length;i++){
        try { targets[i].style.setProperty(prop, value, "important"); } catch (_) {}
      }
    }
    // Remove props no longer overridden.
    for (var oldProp in prev){
      if (next[oldProp]) continue;
      for (var j=0;j<targets.length;j++){
        try { targets[j].style.removeProperty(oldProp); } catch (_) {}
      }
    }
    appliedProps[selector] = next;
  }

  function clearStyles(selector){
    var prev = appliedProps[selector];
    if (!prev) return;
    var targets = findTargets(selector);
    for (var prop in prev){
      for (var i=0;i<targets.length;i++){
        try { targets[i].style.removeProperty(prop); } catch (_) {}
      }
    }
    delete appliedProps[selector];
  }

  window.addEventListener("message", function(e){
    var d = e.data;
    if (!d || d.${INSPECTOR_MARKER} !== true) return;
    if (d.type === "activate") activate(true);
    else if (d.type === "deactivate") activate(false);
    else if (d.type === "apply_style") applyStyles(d.selector, d.css || {});
    else if (d.type === "clear_styles") clearStyles(d.selector);
  });

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", ensureOverlay, { once: true });
  } else {
    ensureOverlay();
  }
})();`;

export function injectInspectorScript(html: string): string {
  if (html.includes(INSPECTOR_MARKER)) return html;
  const tag = `<script data-sandpack-inspector="1">${INSPECTOR_SCRIPT}</script>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}</head>`);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}${tag}`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body[^>]*>/i, (m) => `${m}${tag}`);
  return tag + html;
}
