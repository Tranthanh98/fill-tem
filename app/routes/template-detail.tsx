import { useEffect, useMemo, useRef, useState } from "react";
import { data, Link } from "react-router";

import type { Route } from "./+types/template-detail";
import { TemplateDocument } from "../components/template-document";
import { getTemplate } from "../template-library.server";
import {
  getDefaultValues,
  type TemplateValues,
} from "../template-types";

export function loader({ params }: Route.LoaderArgs) {
  const template = getTemplate(params.templateId);

  if (!template) {
    throw data("Template not found", { status: 404 });
  }

  return { template };
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

export default function TemplateDetail({ loaderData }: Route.ComponentProps) {
  const { template } = loaderData;
  const defaults = useMemo(() => getDefaultValues(template), [template]);
  const storageKey = `template-studio:${template.id}:v${template.schemaVersion}`;
  const [values, setValues] = useState<TemplateValues>(defaults);
  const [zoom, setZoom] = useState(template.builderScale);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);

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
    iframeRef.current?.contentWindow?.print();
  }

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
            <p>Changes are rendered instantly in the preview.</p>
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
              <TemplateDocument
                iframeRef={iframeRef}
                scale={zoom}
                template={template}
                values={values}
                title={`${template.name} live preview`}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
