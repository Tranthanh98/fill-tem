import { useMemo, type RefObject } from "react";

import legacyTemplate from "../html-template/YUNGCHENG_PA YCT_10 X 4.7.html?raw";
import productionTemplate from "../html-template/YUNGCHENG_PA_YCT1_15_X_940.html?raw";
import licenseLogoUrl from "../html-template/assets/yungcheng-pa-yct1/food-production-license.png";
import materialQrUrl from "../html-template/assets/yungcheng-pa-yct1/material-qr.png";
import productQrUrl from "../html-template/assets/yungcheng-pa-yct1/product-qr.png";
import type { TemplateDefinition, TemplateValues } from "../template-data";

type TemplateDocumentProps = {
  iframeRef?: RefObject<HTMLIFrameElement | null>;
  scale: number;
  template: TemplateDefinition;
  values: TemplateValues;
  title: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function replaceElementContent(html: string, selector: string, value: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(<([a-zA-Z0-9]+)[^>]+class=["'][^"']*\\b${escapedSelector}\\b[^"']*["'][^>]*>)[\\s\\S]*?(<\\/\\2>)`,
  );
  return html.replace(pattern, `$1${value}$3`);
}

function buildProductionDocument(values: TemplateValues) {
  let html = productionTemplate
    .replace(
      "assets/yungcheng-pa-yct1/food-production-license.png",
      licenseLogoUrl,
    )
    .replace("assets/yungcheng-pa-yct1/product-qr.png", productQrUrl)
    .replace("assets/yungcheng-pa-yct1/material-qr.png", materialQrUrl);

  html = replaceElementContent(
    html,
    "product-name-cn",
    escapeHtml(values.productNameCn),
  );
  html = replaceElementContent(
    html,
    "product-name-en",
    escapeHtml(values.productNameEn),
  );
  html = replaceElementContent(html, "type-value", escapeHtml(values.type));
  html = replaceElementContent(
    html,
    "thickness-value",
    `${escapeHtml(values.thickness)} <span class="unit">μm</span>`,
  );
  html = replaceElementContent(
    html,
    "net-value",
    `${escapeHtml(values.netWeight)} <span class="unit">kg</span>`,
  );
  html = replaceElementContent(html, "corona-value", escapeHtml(values.corona));
  html = replaceElementContent(html, "grade-value", escapeHtml(values.grade));
  html = replaceElementContent(html, "width-value", escapeHtml(values.width));
  html = replaceElementContent(
    html,
    "product-number",
    escapeHtml(values.productNumber),
  );
  html = replaceElementContent(
    html,
    "joint-count",
    escapeHtml(values.jointCount),
  );
  html = replaceElementContent(html, "length-value", escapeHtml(values.length));
  html = replaceElementContent(
    html,
    "grade-mark",
    escapeHtml(values.gradeMark),
  );
  html = replaceElementContent(html, "material", escapeHtml(values.material));
  html = replaceElementContent(
    html,
    "company-cn",
    escapeHtml(values.companyCn),
  );
  html = replaceElementContent(
    html,
    "company-en",
    escapeHtml(values.companyEn),
  );
  html = replaceElementContent(
    html,
    "date-value",
    escapeHtml(values.productionDate),
  );
  html = replaceElementContent(
    html,
    "shelf-life",
    escapeHtml(values.shelfLife),
  );
  html = replaceElementContent(
    html,
    "inspection-marks",
    ` <span>二</span>${escapeHtml(values.inspector)}</span>`,
  );

  return html;
}

function buildLegacyDocument(values: TemplateValues) {
  const safe = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, escapeHtml(value)]),
  ) as TemplateValues;

  const style = legacyTemplate.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";

  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        ${style}
        html, body { width: 860px; height: 560px; min-height: 560px; overflow: hidden; }
        body { padding: 20px 30px; }
        .label-card { height: 520px; }
        .legacy-header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px; }
        .legacy-header strong { color:#0d63a5; font-size:23px; }
        .legacy-header span { color:#0d63a5; font-size:16px; }
        .qr-code { object-fit:cover; image-rendering:pixelated; }
      </style>
    </head>
    <body>
      <main class="label-card">
        <div class="legacy-header"><strong>${safe.productNameCn}</strong><span>${safe.productNameEn}</span></div>
        <div class="grid-row">
          <div class="col"><div class="label-title">产品类型 TYPE</div><div class="label-value">${safe.type}</div></div>
          <div class="col"><div class="label-title">厚度THICKNESS</div><div class="label-value">${safe.thickness} <span class="unit">μm</span></div></div>
          <div class="col"><div class="label-title">等级GRADE</div><div class="label-value">${safe.grade}</div></div>
          <div class="col"><div class="label-title">电晕CORONA</div><div class="label-value">${safe.corona}</div></div>
        </div>
        <div class="grid-row">
          <div class="col"><div class="label-title">宽度 WIDTH</div><div class="label-value">${safe.width} <span class="unit">mm</span></div></div>
          <div class="col"><div class="label-title">卷长 LENGTH</div><div class="label-value">${safe.length} <span class="unit">m</span></div></div>
          <div class="col"><div class="label-title">净重NET.</div><div class="label-value">${safe.netWeight} <span class="unit">kg</span></div></div>
          <div class="col"><div class="label-title">检验员 INSPECTOR</div><div class="label-value">${safe.inspector}</div></div>
        </div>
        <div class="grid-row-3">
          <div class="col"><div class="label-title">接头数JOINT</div><div class="label-value">${safe.jointCount}</div></div>
          <div class="col"><div class="label-title">生产日期 DATE</div><div class="label-value" style="font-size:22px">${safe.productionDate}</div></div>
          <div class="col col-right"><div class="label-title">出厂编号 PRODUCT NO.</div><div class="label-value" style="font-size:22px">${safe.productNumber}</div></div>
        </div>
        <div class="bottom-section">
          <div class="brand-block"><div class="brand-cn">${safe.companyCn}</div><div class="brand-en">${safe.companyEn}</div></div>
          <div class="qr-material-block"><img class="qr-code" src="${productQrUrl}" alt="Product QR code" /><div class="material-text">${safe.material}</div></div>
        </div>
      </main>
    </body>
  </html>`;
}

export function TemplateDocument({
  iframeRef,
  scale,
  template,
  values,
  title,
}: TemplateDocumentProps) {
  const source = useMemo(
    () =>
      template.variant === "production"
        ? buildProductionDocument(values)
        : buildLegacyDocument(values),
    [template.variant, values],
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
        style={{
          width: template.canvas.width,
          height: template.canvas.height,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}
