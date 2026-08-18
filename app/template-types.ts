export type TemplateFieldType = "text" | "number" | "date" | "textarea";

export type TemplateField = {
  key: string;
  label: string;
  type: TemplateFieldType;
  default: string;
  unit?: string;
  placeholder?: string;
  step?: string;
};

export type TemplateFieldGroup = {
  title: string;
  fields: TemplateField[];
};

export type TemplateManifest = {
  schemaVersion: number;
  order?: number;
  id: string;
  name: string;
  description: string;
  category: string;
  canvas: { width: number; height: number };
  thumbnailScale: number;
  builderScale: number;
  fieldGroups: TemplateFieldGroup[];
};

export type TemplateDefinition = TemplateManifest & {
  sourceFile: string;
  templateHtml: string;
};

export type TemplateValues = Record<string, string>;

const templateTokenPattern = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;

export function getTemplateFields(template: TemplateDefinition) {
  return template.fieldGroups.flatMap((group) => group.fields);
}

export function getDefaultValues(template: TemplateDefinition) {
  return Object.fromEntries(
    getTemplateFields(template).map((field) => [field.key, field.default]),
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderTemplateHtml(
  templateHtml: string,
  values: TemplateValues,
) {
  return templateHtml.replace(templateTokenPattern, (_, key: string) =>
    escapeHtml(values[key] ?? ""),
  );
}

export function getTemplateTokens(templateHtml: string) {
  return Array.from(templateHtml.matchAll(templateTokenPattern), (match) => match[1]);
}
