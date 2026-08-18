import type { Route } from "./+types/home";
import { useState } from "react";
import { Link } from "react-router";

import { TemplateDocument } from "../components/template-document";
import { listTemplates } from "../template-library.server";
import { getDefaultValues } from "../template-types";

export function loader() {
  return { templates: listTemplates() };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Template Studio" },
    { name: "description", content: "Browse and edit print templates." },
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { templates } = loaderData;
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleTemplates = normalizedQuery
    ? templates.filter((template) =>
        [template.name, template.description, template.sourceFile]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : templates;

  return (
    <div className="app-page dashboard-page">
      <header className="app-header">
        <Link className="brand" to="/" aria-label="Template Studio home">
          <span className="brand-mark">T</span>
          <span>Template Studio</span>
        </Link>
        <div className="header-actions">
          <span className="template-count">{templates.length} templates</span>
          <div className="avatar" aria-label="Current workspace">FT</div>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="dashboard-heading">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>Your templates</h1>
            <p className="heading-copy">
              Pick a template, edit its fields, and preview the final label in real time.
            </p>
          </div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Search templates"
              aria-label="Search templates"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </section>

        <section className="template-grid" aria-label="Available templates">
          {visibleTemplates.map((template) => (
            <Link
              className="template-card"
              key={template.id}
              to={`/templates/${template.id}`}
              prefetch="intent"
            >
              <div className="template-thumbnail">
                <TemplateDocument
                  scale={template.thumbnailScale}
                  template={template}
                  values={getDefaultValues(template)}
                  title={`${template.name} preview`}
                />
                <span className="open-template">Open editor →</span>
              </div>
              <div className="template-card-copy">
                <div>
                  <span className="category-pill">{template.category}</span>
                  <h2>{template.name}</h2>
                  <p>{template.description}</p>
                </div>
                <span className="file-name">{template.sourceFile}</span>
              </div>
            </Link>
          ))}

          {normalizedQuery ? null : (
            <article className="template-card new-template-card">
              <div className="new-template-icon" aria-hidden="true">+</div>
              <h2>Template library</h2>
              <p>Add more HTML labels to grow this workspace.</p>
            </article>
          )}

          {visibleTemplates.length === 0 ? (
            <div className="empty-templates">
              <span>No templates found</span>
              <p>Try another name or file keyword.</p>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
