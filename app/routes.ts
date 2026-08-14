import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("templates/:templateId", "routes/template-detail.tsx"),
] satisfies RouteConfig;
