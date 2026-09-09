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

function restoreValues(saved: unknown, defaults: TemplateValues) {
  if (!saved || typeof saved !== "object") return defaults;

  const savedValues = saved as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      typeof savedValues[key] === "string" ? savedValues[key] : fallback,
    ]),
  );
}

type TemplateInstance = {
  id: string;
  values: TemplateValues;
};

function restoreInstances(saved: string | null, defaults: TemplateValues) {
  if (!saved) return [{ id: "label-1", values: defaults }];

  const parsed = JSON.parse(saved) as unknown;
  if (!parsed || typeof parsed !== "object") {
    return [{ id: "label-1", values: defaults }];
  }

  const savedInstances = (parsed as { instances?: unknown }).instances;
  if (Array.isArray(savedInstances) && savedInstances.length > 0) {
    return savedInstances.map((instance, index) => ({
      id: `label-${index + 1}`,
      values: restoreValues(
        instance && typeof instance === "object"
          ? (instance as { values?: unknown }).values
          : null,
        defaults,
      ),
    }));
  }

  // Keep saved templates from the previous single-label format working.
  return [{ id: "label-1", values: restoreValues(parsed, defaults) }];
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

function getTemplateFrameWidth(template: TemplateDefinition) {
  return template.canvas.frameWidth ?? template.canvas.width;
}

function getPairTargetFrameWidth(templates: TemplateDefinition[]) {
  return Math.min(...templates.map(getTemplateFrameWidth));
}

function getWidthScale(template: TemplateDefinition, targetFrameWidth: number) {
  const frameWidth = getTemplateFrameWidth(template);
  return frameWidth === 0 ? 1 : targetFrameWidth / frameWidth;
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
  // - `:root` and `html` stay unscoped (they target the document root and
  //   define CSS variables that would be lost if scoped).
  // - `body` is replaced with the prefix itself (e.g. `.page-1`) so that the
  //   template's body styles (flex centering, padding, font, color) are applied
  //   directly to the page wrapper div in the print output.
  const scopedTopLevel = withPlaceholders.replace(
    /([^{}\s][^{}]*)\{/g,
    (match, selectors: string) => {
      const trimmed = selectors.trim();
      if (trimmed.startsWith("@")) return match;
      const scoped = trimmed
        .split(",")
        .map((selector) => {
          const single = selector.trim();
          if (single === "body") return prefix;
          if (
            single === "html" ||
            single.startsWith(":root") ||
            single.startsWith("::")
          ) {
            return single;
          }
          return `${prefix} ${single}`;
        })
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

function markCjkTextForPrint(doc: Document) {
  const cjkPattern = /([\u3400-\u9fff\uf900-\ufaff]+)/g;
  const cjkTestPattern = /[\u3400-\u9fff\uf900-\ufaff]/;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (cjkTestPattern.test(node.data)) textNodes.push(node);
  }

  textNodes.forEach((node) => {
    const fragment = doc.createDocumentFragment();
    node.data.split(cjkPattern).forEach((part) => {
      if (!part) return;
      if (cjkTestPattern.test(part)) {
        const span = doc.createElement("span");
        span.className = "print-cjk";
        span.lang = "zh-CN";
        span.textContent = part;
        fragment.append(span);
      } else {
        fragment.append(doc.createTextNode(part));
      }
    });
    node.replaceWith(fragment);
  });
}

function buildPrintHtml(
  templates: TemplateDefinition[],
  instances: TemplateInstance[],
): string {
  const parser = new DOMParser();
  const gap = 36;
  const targetFrameWidth = getPairTargetFrameWidth(templates);

  const copies = instances.map((instance, copyIndex) => {
    return templates.map((template, templateIndex) => {
      const pageIndex = copyIndex * templates.length + templateIndex + 1;
      const rendered = renderTemplateHtml(
        template.templateHtml,
        instance.values,
      );
      const doc = parser.parseFromString(rendered, "text/html");
      markCjkTextForPrint(doc);
      const styles = Array.from(doc.querySelectorAll("style"))
        .map((style) => scopeCss(style.textContent ?? "", `.page-${pageIndex}`))
        .join("\n")
        .replace(/@page\s*\{[^}]*\}/g, "");
      const bodyStyle = doc.body.getAttribute("style") ?? "";
      const bodyHtml = doc.body.innerHTML;
      const scale = getWidthScale(template, targetFrameWidth);

      return {
        index: pageIndex,
        styles,
        bodyStyle,
        bodyHtml,
        width: template.canvas.width,
        height: template.canvas.height,
        scale,
        renderedWidth: template.canvas.width * scale,
        renderedHeight: template.canvas.height * scale,
      };
    });
  });

  const copyWidth = Math.max(
    ...copies.flat().map((page) => page.renderedWidth),
  );
  const copyHeight = Math.max(
    ...copies.map(
      (pages) =>
        pages.reduce((sum, page) => sum + page.renderedHeight, 0) +
        gap * (pages.length - 1),
    ),
  );
  const millimetersPerInch = 25.4;
  const cssPixelsPerInch = 96;
  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const copyWidthMm = 105;
  const copyWidthPx =
    (copyWidthMm / millimetersPerInch) * cssPixelsPerInch;
  const printScale = copyWidthPx / copyWidth;
  const scaledCopyHeight = copyHeight * printScale;
  const printPages = Array.from(
    { length: Math.ceil(copies.length / 2) },
    (_, pageIndex) => copies.slice(pageIndex * 2, pageIndex * 2 + 2),
  );

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    ${copies.flat().map((page) => `<style>${page.styles}</style>`).join("\n")}
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        width: ${pageWidthMm}mm;
        min-width: ${pageWidthMm}mm;
        min-height: ${pageHeightMm}mm;
        background: #fff;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
      }
      .print-page {
        display: flex;
        width: ${pageWidthMm}mm;
        height: ${pageHeightMm}mm;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        break-after: page;
        page-break-after: always;
      }
      .print-page:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      .print-scaled-copy {
        position: relative;
        width: ${copyWidthMm}mm;
        height: ${scaledCopyHeight}px;
        flex: 0 0 ${copyWidthMm}mm;
      }
      .print-copy {
        position: absolute;
        top: 0;
        left: 0;
        display: flex;
        width: ${copyWidth}px;
        height: ${copyHeight}px;
        flex-direction: column;
        align-items: center;
        gap: ${gap}px;
        transform: scale(${printScale});
        transform-origin: top left;
      }
      .print-template-slot {
        position: relative;
        width: ${copyWidth}px;
        overflow: hidden;
        flex: 0 0 auto;
      }
      .print-template {
        position: absolute;
        top: 0;
        left: 0;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: hidden;
        background: #fff;
        transform-origin: top left;
      }
      .print-cjk {
        font-family: "Songti SC", "STSong", "SimSun", serif !important;
      }
      @media print {
        @page {
          margin: 0;
          size: A4 portrait;
        }
        html, body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
        }
      }
    </style>
  </head>
  <body>
    ${printPages
      .map(
        (pageCopies) => `<section class="print-page">
          ${pageCopies
            .map(
              (pages) => `<div class="print-scaled-copy"><div class="print-copy">${pages
                  .map(
                    (page) =>
                      `<div class="print-template-slot" style="height:${page.renderedHeight}px;"><div class="print-template page-${page.index}" style="${page.bodyStyle}; left:${(copyWidth - page.renderedWidth) / 2}px; width:${page.width}px; height:${page.height}px; transform:scale(${page.scale});">${page.bodyHtml}</div></div>`,
                  )
                  .join("\n")}</div></div>`,
            )
            .join("\n")}
        </section>`,
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
  const [instances, setInstances] = useState<TemplateInstance[]>([
    { id: "label-1", values: defaults },
  ]);
  const [selectedInstanceId, setSelectedInstanceId] = useState("label-1");
  const [zoom, setZoom] = useState(template.builderScale);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const nextInstanceNumber = useRef(2);

  const selectedInstance =
    instances.find((instance) => instance.id === selectedInstanceId) ??
    instances[0];
  const values = selectedInstance?.values ?? defaults;

  const targetFrameWidth = useMemo(
    () => getPairTargetFrameWidth(pairTemplates),
    [pairTemplates],
  );

  function getPreviewScale(item: TemplateDefinition) {
    return getWidthScale(item, targetFrameWidth);
  }

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    try {
      const restoredInstances = restoreInstances(saved, defaults);
      setInstances(restoredInstances);
      setSelectedInstanceId(restoredInstances[0].id);
      nextInstanceNumber.current = restoredInstances.length + 1;
    } catch {
      window.localStorage.removeItem(storageKey);
      setInstances([{ id: "label-1", values: defaults }]);
      setSelectedInstanceId("label-1");
      nextInstanceNumber.current = 2;
    }
    setZoom(template.builderScale);
    setSaveState("idle");
    previewScrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [defaults, storageKey, template.builderScale]);

  function updateField(key: string, value: string) {
    setInstances((current) =>
      current.map((instance) =>
        instance.id === selectedInstanceId
          ? { ...instance, values: { ...instance.values, [key]: value } }
          : instance,
      ),
    );
    setSaveState("idle");
  }

  function addMore() {
    const newInstance: TemplateInstance = {
      id: `label-${nextInstanceNumber.current}`,
      values: { ...values },
    };
    nextInstanceNumber.current += 1;
    setInstances((current) => [...current, newInstance]);
    setSelectedInstanceId(newInstance.id);
    setSaveState("idle");
  }

  function saveTemplate() {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ instances: instances.map(({ values }) => ({ values })) }),
    );
    setSaveState("saved");
  }

  function resetTemplate() {
    setInstances((current) => {
      const resetInstances = current.map((instance) =>
        instance.id === selectedInstanceId
          ? { ...instance, values: defaults }
          : instance,
      );
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          instances: resetInstances.map(({ values }) => ({ values })),
        }),
      );
      return resetInstances;
    });
    setSaveState("idle");
  }

  async function printTemplate() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(buildPrintHtml(pairTemplates, instances));
    printWindow.document.close();
    printWindow.focus();

    const images = Array.from(printWindow.document.images);
    await Promise.all([
      printWindow.document.fonts.ready,
      ...images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }),
      ),
    ]);

    await new Promise<void>((resolve) => {
      printWindow.requestAnimationFrame(() => {
        printWindow.requestAnimationFrame(() => resolve());
      });
    });

    if (printWindow.closed) return;
    printWindow.addEventListener("afterprint", () => printWindow.close(), {
      once: true,
    });
    printWindow.print();
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
          <button className="button button-secondary add-more-button" type="button" onClick={addMore}>
            + Add more
          </button>
          <button className="button button-secondary print-button" type="button" onClick={printTemplate}>
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
            <h2>Label {instances.indexOf(selectedInstance) + 1} fields</h2>
            <p>
              Select a label below or in the preview, then edit its fields
              {isPair ? " for both labels in this pair" : ""}.
            </p>
            <div className="label-selector" aria-label="Select a label to edit">
              {instances.map((instance, index) => (
                <button
                  aria-pressed={instance.id === selectedInstanceId}
                  className={instance.id === selectedInstanceId ? "is-selected" : ""}
                  key={instance.id}
                  onClick={() => setSelectedInstanceId(instance.id)}
                  type="button"
                >
                  Label {index + 1}
                </button>
              ))}
            </div>
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
              {` · ${instances.length} ${instances.length === 1 ? "copy" : "copies"}`}
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
            <div className="preview-canvas-wrap">
              <div className="preview-sheet">
                {instances.map((instance, instanceIndex) => (
                  <button
                    aria-label={`Edit label ${instanceIndex + 1}`}
                    aria-pressed={instance.id === selectedInstanceId}
                    className={`preview-copy${
                      instance.id === selectedInstanceId ? " is-selected" : ""
                    }`}
                    key={instance.id}
                    onClick={() => setSelectedInstanceId(instance.id)}
                    type="button"
                  >
                    <span className="preview-copy-label">Label {instanceIndex + 1}</span>
                    {pairTemplates.map((item) => (
                      <span className="preview-sheet-item" key={item.id}>
                        <TemplateDocument
                          iframeRef={registerIframe(`${instance.id}:${item.id}`)}
                          scale={getPreviewScale(item) * zoom}
                          template={item}
                          values={instance.values}
                          title={`${item.name} label ${instanceIndex + 1} live preview`}
                        />
                      </span>
                    ))}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
