import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/marketing-layout.tsx", [
    index("routes/home.tsx"),
  ]),
  layout("routes/dashboard-layout.tsx", [
    route("dashboard", "routes/dashboard/home.tsx"),
    route("dashboard/profile", "routes/dashboard/profile.tsx"),
  ]),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("logout", "routes/logout.tsx"),
  route("health", "routes/health.ts"),
  route("ready", "routes/ready.ts"),
] satisfies RouteConfig;
