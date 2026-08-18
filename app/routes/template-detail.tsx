import { useEffect, useMemo, useRef, useState } from "react";
import { data, Link } from "react-router";

import type { Route } from "./+types/template-detail";
import { TemplateDocument } from "../components/template-document";
import { getTemplate, getTemplatePair } from "../template-library.server";
import {
  getDefaultValues,
  renderTemplateHtml,
  type TemplateDefinition,
  type TemplateValues,
} from "../template-types";

export function loader({ params }: Route.LoaderArgs) {
  const template = getTemplate(params.templateId);

  if (!template) {
    throw data("Template not found", { status: 404 });
  }

  const pairTemplates = template.pairId
    ? getTemplatePair(template.pairId).sort(
        (left, right) =>
          (left.order ?? Number.MAX_SAFE_INTEGER) -
          (right.order ?? Number.MAX_SAFE_INTEGER),
      )
    : [template];

  return { template, pairTemplates };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: loaderData
        ? `${loaderData.template.name} · Template Studio`
        : "Template Studio",
    },
  ];
}

function restoreValues(saved: string | null, defaults: TemplateValues) {
  if (!saved) return defaults;

  const parsed = JSON.parse(saved) as unknown;
  if (!parsed || typeof parsed !== "object") return defaults;

  const savedValues = parsed as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      typeof savedValues[key] === "string" ? savedValues[key] : fallback,
    ]),
  );
}

function getPairDefaultValues(templates: TemplateDefinition[]) {
  return templates.reduce<TemplateValues>(
    (merged, item) => ({ ...merged, ...getDefaultValues(item) }),
    {},
  );
}

function getStorageKey(templates: TemplateDefinition[]) {
  const pairId = templates[0]?.pairId;
  const schemaVersion = Math.max(...templates.map((item) => item.schemaVersion));

  return pairId
    ? `template-studio:pair:${pairId}:v${schemaVersion}`
    : `template-studio:${templates[0]?.id}:v${schemaVersion}`;
}

function scopeCss(css: string, prefix: string): string {
  // Remove comments.
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // Temporarily remove @media blocks so they are not scoped twice.
  const mediaBlocks: string[] = [];
  const withPlaceholders = cleaned.replace(
    /@media[^{]+\{[\s\S]+?\}\s*\}/g,
    (match) => {
      mediaBlocks.push(match);
      return `__MEDIA_BLOCK_${mediaBlocks.length - 1}__`;
    },
  );

  // Scope top-level rules. Skip @-rules.
  const scopedTopLevel = withPlaceholders.replace(
    /([^{}\s][^{}]*)\{/g,
    (match, selectors: string) => {
      const trimmed = selectors.trim();
      if (trimmed.startsWith("@")) return match;
      const scoped = trimmed
        .split(",")
        .map((selector) => `${prefix} ${selector.trim()}`)
        .join(", ");
      return match.replace(trimmed, scoped);
    },
  );

  // Restore and scope the content inside @media blocks.
  const scopedMedia = mediaBlocks.map((block) => {
    const match = block.match(/(@media[^{]+)\{([\s\S]+)\}\s*\}$/);
    if (!match) return block;
    const [, mediaQuery, content] = match;
    return `${mediaQuery} { ${scopeCss(content, prefix)} }`;
  });

  return scopedTopLevel.replace(
    /__MEDIA_BLOCK_(\d+)__/g,
    (_, index) => scopedMedia[Number(index)],
  );
}

function buildPrintHtml(
  templates: TemplateDefinition[],
  values: TemplateValues,
): string {
  const parser = new DOMParser();
  const pages = templates.map((template, index) => {
    const rendered = renderTemplateHtml(template.templateHtml, values);
    const doc = parser.parseFromString(rendered, "text/html");
    const styles = Array.from(doc.querySelectorAll("style"))
      .map((style) => scopeCss(style.textContent ?? "", `.page-${index + 1}`))
      .join("\n");
    const bodyStyle = doc.body.getAttribute("style") ?? "";
    const bodyHtml = doc.body.innerHTML;

    return {
      index: index + 1,
      styles,
      bodyStyle,
      bodyHtml,
      width: template.canvas.width,
      height: template.canvas.height,
    };
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    ${pages.map((page) => `<style>${page.styles}</style>`).join("\n")}
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      @media print {
        @page { margin: 0; }
        .print-page { page-break-after: always; }
        .print-page:last-child { page-break-after: auto; }
      }
      .print-page {
        position: relative;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    ${pages
      .map(
        (page) =>
          `<div class="print-page page-${page.index}" style="${page.bodyStyle} width:${page.width}px; height:${page.height}px;">${page.bodyHtml}</div>`,
      )
      .join("\n")}
  </body>
</html>`;
}

export default function TemplateDetail({ loaderData }: Route.ComponentProps) {
  const { template, pairTemplates } = loaderData;
  const defaults = useMemo(
    () => getPairDefaultValues(pairTemplates),
    [pairTemplates],
  );
  const storageKey = useMemo(
    () => getStorageKey(pairTemplates),
    [pairTemplates],
  );
  const [values, setValues] = useState<TemplateValues>(defaults);
  const [zoom, setZoom] = useState(template.builderScale);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());
  const previewScrollRef = useRef<HTMLDivElement>(null);

  const targetWidth = useMemo(
    () => Math.min(...pairTemplates.map((item) => item.canvas.width)),
    [pairTemplates],
  );

  function getPreviewScale(item: TemplateDefinition) {
    return item.canvas.width === 0 ? 1 : targetWidth / item.canvas.width;
  }

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    try {
      setValues(restoreValues(saved, defaults));
    } catch {
      window.localStorage.removeItem(storageKey);
      setValues(defaults);
    }
    setZoom(template.builderScale);
    setSaveState("idle");
    previewScrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [defaults, storageKey, template.builderScale]);

  function updateField(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  function saveTemplate() {
    window.localStorage.setItem(storageKey, JSON.stringify(values));
    setSaveState("saved");
  }

  function resetTemplate() {
    setValues(defaults);
    window.localStorage.removeItem(storageKey);
    setSaveState("idle");
  }

  function printTemplate() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(buildPrintHtml(pairTemplates, values));
    printWindow.document.close();
    printWindow.focus();

    const triggerPrint = () => {
      printWindow.print();
      printWindow.addEventListener("afterprint", () => printWindow.close());
    };

    // Give the browser a moment to render styles before printing.
    setTimeout(triggerPrint, 300);
  }

  function registerIframe(templateId: string) {
    return (element: HTMLIFrameElement | null) => {
      if (element) {
        iframeRefs.current.set(templateId, element);
      } else {
        iframeRefs.current.delete(templateId);
      }
    };
  }

  const isPair = pairTemplates.length > 1;

  return (
    <div className="builder-page">
      <header className="builder-header">
        <div className="builder-header-left">
          <Link className="back-button" to="/" aria-label="Back to templates">
            ←
          </Link>
          <div>
            <p className="builder-breadcrumb">Templates / {template.category}</p>
            <h1>{template.name}</h1>
          </div>
        </div>
        <div className="builder-actions">
          <button className="button button-ghost" type="button" onClick={resetTemplate}>
            Reset
          </button>
          <button className="button button-secondary" type="button" onClick={printTemplate}>
            Print
          </button>
          <button className="button button-primary" type="button" onClick={saveTemplate}>
            {saveState === "saved" ? "Saved ✓" : "Save template"}
          </button>
        </div>
      </header>

      <main className="builder-workspace">
        <aside className="editor-panel" aria-label="Template fields">
          <div className="editor-intro">
            <p className="eyebrow">Content</p>
            <h2>Template fields</h2>
            <p>
              Changes are rendered instantly in the preview
              {isPair ? " for both pages in this pair" : ""}.
            </p>
          </div>

          <div className="field-sections">
            {template.fieldGroups.map((section) => (
              <section className="field-section" key={section.title}>
                <h3>{section.title}</h3>
                <div className="field-list">
                  {section.fields.map((field) => {
                    const inputId = `${template.id}-${field.key}`;
                    return (
                      <label className="form-field" htmlFor={inputId} key={field.key}>
                        <span>{field.label}</span>
                        <div className="input-wrap">
                          {field.type === "textarea" ? (
                            <textarea
                              id={inputId}
                              value={values[field.key] ?? ""}
                              placeholder={field.placeholder}
                              onChange={(event) => updateField(field.key, event.target.value)}
                            />
                          ) : (
                            <input
                              id={inputId}
                              type={field.type}
                              value={values[field.key] ?? ""}
                              placeholder={field.placeholder}
                              step={field.step}
                              onChange={(event) => updateField(field.key, event.target.value)}
                            />
                          )}
                          {field.unit ? <span className="input-unit">{field.unit}</span> : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </aside>

        <section className="preview-panel" aria-label="Live template preview">
          <div className="preview-toolbar">
            <div>
              <span className="status-dot" />
              Live preview
              {isPair ? ` · ${pairTemplates.length} pages` : ""}
            </div>
            <div className="zoom-control" aria-label="Preview zoom">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoom((current) => Math.max(0.25, current - 0.05))}
              >
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoom((current) => Math.min(1, current + 0.05))}
              >
                +
              </button>
            </div>
          </div>

          <div className="preview-scroll-area" ref={previewScrollRef}>
            <div className="preview-canvas-wrap preview-pair-wrap">
              {pairTemplates.map((item) => (
                <div className="preview-pair-item" key={item.id}>
                  <TemplateDocument
                    iframeRef={registerIframe(item.id)}
                    scale={getPreviewScale(item) * zoom}
                    template={item}
                    values={values}
                    title={`${item.name} live preview`}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
