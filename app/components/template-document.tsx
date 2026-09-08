import { useMemo, type Ref } from "react";

import type { TemplateDefinition, TemplateValues } from "../template-types";
import { renderTemplateHtml } from "../template-types";

type TemplateDocumentProps = {
  iframeRef?: Ref<HTMLIFrameElement | null>;
  scale: number;
  template: TemplateDefinition;
  values: TemplateValues;
  title: string;
};

export function TemplateDocument({
  iframeRef,
  scale,
  template,
  values,
  title,
}: TemplateDocumentProps) {
  const source = useMemo(
    () =>
      renderTemplateHtml(template.templateHtml, values) +
      "<style>body{background:transparent !important}</style>",
    [template.templateHtml, values],
  );

  return (
    <div
      className="template-document-size"
      style={{
        width: template.canvas.width * scale,
        height: template.canvas.height * scale,
      }}
    >
      <iframe
        ref={iframeRef}
        className="template-document-frame"
        srcDoc={source}
        title={title}
        tabIndex={-1}
        sandbox="allow-modals allow-same-origin"
        style={{
          width: template.canvas.width,
          height: template.canvas.height,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}
