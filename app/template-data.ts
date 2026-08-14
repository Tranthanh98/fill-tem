export type TemplateVariant = "production" | "legacy";

export type TemplateValues = {
  productNameCn: string;
  productNameEn: string;
  type: string;
  thickness: string;
  grade: string;
  width: string;
  netWeight: string;
  corona: string;
  productNumber: string;
  jointCount: string;
  length: string;
  gradeMark: string;
  material: string;
  companyCn: string;
  companyEn: string;
  productionDate: string;
  shelfLife: string;
  inspector: string;
};

export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  category: string;
  sourceFile: string;
  variant: TemplateVariant;
  canvas: { width: number; height: number };
  thumbnailScale: number;
  builderScale: number;
  defaults: TemplateValues;
};

const sharedDefaults: TemplateValues = {
  productNameCn: "双向拉伸尼龙薄膜",
  productNameEn: "BOPA",
  type: "PA",
  thickness: "15",
  grade: "YCT1",
  width: "940",
  netWeight: "97.3",
  corona: "Inside",
  productNumber: "L12674108854",
  jointCount: "0",
  length: "6000",
  gradeMark: "F3",
  material: "产品材质: 聚酰胺-6(PA6)",
  companyCn: "昆山运城塑业有限公司",
  companyEn: "KUNSHAN YUNCHENG PLASTIC INDUSTRY CO., LTD",
  productionDate: "2026-06-18",
  shelfLife: "贮存期二年",
  inspector: "合格",
};

export const templates: TemplateDefinition[] = [
  {
    id: "yungcheng-pa-yct1-15-940",
    name: "YUNGCHENG PA YCT1",
    description: "Production label · 15 μm × 940 mm",
    category: "Product label",
    sourceFile: "YUNGCHENG_PA_YCT1_15_X_940.html",
    variant: "production",
    canvas: { width: 1032, height: 1192 },
    thumbnailScale: 0.205,
    builderScale: 0.58,
    defaults: sharedDefaults,
  },
  {
    id: "yungcheng-pa-yct-10-4-7",
    name: "YUNGCHENG PA YCT",
    description: "Compact label · 10 × 4.7",
    category: "Product label",
    sourceFile: "YUNGCHENG_PA YCT_10 X 4.7.html",
    variant: "legacy",
    canvas: { width: 860, height: 560 },
    thumbnailScale: 0.31,
    builderScale: 0.82,
    defaults: {
      ...sharedDefaults,
      productNameEn: "Biaxial Orientated Polyamide film",
      gradeMark: "",
    },
  },
];

export function getTemplate(templateId: string) {
  return templates.find((template) => template.id === templateId);
}
