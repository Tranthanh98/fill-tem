import type {
  TemplateDefinition,
  TemplateField,
  TemplateManifest,
} from "./template-types";
import { getTemplateTokens } from "./template-types";

const htmlModules = import.meta.glob("./html-template/*.html", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const manifestModules = import.meta.glob("./html-template/*.manifest.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const assetModules = import.meta.glob("./html-template/assets/**/*", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTemplateField(value: unknown): value is TemplateField {
  if (!isRecord(value)) return false;
  return (
    typeof value.key === "string" &&
    typeof value.label === "string" &&
    typeof value.default === "string" &&
    (value.unit === undefined || typeof value.unit === "string") &&
    (value.placeholder === undefined || typeof value.placeholder === "string") &&
    (value.step === undefined || typeof value.step === "string") &&
    ["text", "number", "date", "textarea"].includes(String(value.type))
  );
}

function parseManifest(value: unknown, manifestPath: string): TemplateManifest {
  if (
    !isRecord(value) ||
    typeof value.schemaVersion !== "number" ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.description !== "string" ||
    typeof value.category !== "string" ||
    !isRecord(value.canvas) ||
    typeof value.canvas.width !== "number" ||
    typeof value.canvas.height !== "number" ||
    (value.canvas.frameWidth !== undefined &&
      typeof value.canvas.frameWidth !== "number") ||
    typeof value.thumbnailScale !== "number" ||
    typeof value.builderScale !== "number" ||
    !Array.isArray(value.fieldGroups)
  ) {
    throw new Error(`Invalid template manifest: ${manifestPath}`);
  }

  const fieldGroups = value.fieldGroups.map((group) => {
    if (
      !isRecord(group) ||
      typeof group.title !== "string" ||
      !Array.isArray(group.fields) ||
      !group.fields.every(isTemplateField)
    ) {
      throw new Error(`Invalid field group in template manifest: ${manifestPath}`);
    }

    return {
      title: group.title,
      fields: group.fields,
    };
  });

  return {
    schemaVersion: value.schemaVersion,
    order: typeof value.order === "number" ? value.order : undefined,
    id: value.id,
    pairId: typeof value.pairId === "string" ? value.pairId : undefined,
    name: value.name,
    description: value.description,
    category: value.category,
    canvas: {
      width: value.canvas.width,
      height: value.canvas.height,
      frameWidth:
        typeof value.canvas.frameWidth === "number"
          ? value.canvas.frameWidth
          : undefined,
    },
    thumbnailScale: value.thumbnailScale,
    builderScale: value.builderScale,
    fieldGroups,
  };
}

function resolveRelativePath(sourcePath: string, reference: string) {
  const pathParts = sourcePath.split("/").slice(0, -1);

  for (const part of reference.replace(/^\.\//, "").split("/")) {
    if (part === "..") pathParts.pop();
    else if (part !== "." && part !== "") pathParts.push(part);
  }

  return pathParts.join("/");
}

function resolveTemplateAssets(html: string, htmlPath: string) {
  const replaceReference = (fullMatch: string, prefix: string, reference: string, suffix: string) => {
    if (/^(?:[a-z]+:|\/|#|data:)/i.test(reference)) return fullMatch;
    const assetUrl = assetModules[resolveRelativePath(htmlPath, reference)];
    if (!assetUrl && /^(?:\.\/)?assets\//.test(reference)) {
      throw new Error(`Missing template asset in ${htmlPath}: ${reference}`);
    }
    return assetUrl ? `${prefix}${assetUrl}${suffix}` : fullMatch;
  };

  return html
    .replace(
      /\b(?:src|href)=(['"])([^'"]+)\1/g,
      (fullMatch, quote: string, reference: string) =>
        replaceReference(fullMatch, fullMatch.slice(0, fullMatch.indexOf(quote) + 1), reference, quote),
    )
    .replace(
      /url\((['"]?)([^)'"\s]+)\1\)/g,
      (fullMatch, quote: string, reference: string) =>
        replaceReference(fullMatch, `url(${quote}`, reference, `${quote})`),
    );
}

function validateTemplate(template: TemplateDefinition, manifestPath: string) {
  const fields = template.fieldGroups.flatMap((group) => group.fields);
  const fieldKeys = new Set(fields.map((field) => field.key));

  if (fieldKeys.size !== fields.length) {
    throw new Error(`Duplicate field key in template manifest: ${manifestPath}`);
  }

  const unknownTokens = getTemplateTokens(template.templateHtml).filter(
    (token) => !fieldKeys.has(token),
  );

  if (unknownTokens.length > 0) {
    throw new Error(
      `Unknown template tokens in ${template.sourceFile}: ${[...new Set(unknownTokens)].join(", ")}`,
    );
  }
}

const templates = Object.entries(manifestModules)
  .map(([manifestPath, rawManifest]) => {
    const manifest = parseManifest(rawManifest, manifestPath);
    const htmlPath = manifestPath.replace(/\.manifest\.json$/, ".html");
    const html = htmlModules[htmlPath];

    if (!html) {
      throw new Error(`Missing HTML file for template manifest: ${manifestPath}`);
    }

    const template: TemplateDefinition = {
      ...manifest,
      sourceFile: htmlPath.split("/").at(-1) ?? htmlPath,
      templateHtml: resolveTemplateAssets(html, htmlPath),
    };

    validateTemplate(template, manifestPath);
    return template;
  })
  .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER));

const templateById = new Map(templates.map((template) => [template.id, template]));

if (templateById.size !== templates.length) {
  throw new Error("Template IDs must be unique");
}

export function listTemplates() {
  return templates;
}

export function getTemplate(templateId: string) {
  return templateById.get(templateId);
}

export function getTemplatePair(pairId: string) {
  return templates.filter((template) => template.pairId === pairId);
}
