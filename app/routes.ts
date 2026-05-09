import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/marketing-layout.tsx", [
    index("routes/home.tsx"),
  ]),
  layout("routes/dashboard-layout.tsx", [
    route("dashboard", "routes/dashboard/home.tsx"),
    route("dashboard/home", "routes/dashboard/home.tsx", { id: "dashboard-home-alias" }),
    route("dashboard/profile", "routes/dashboard/profile.tsx"),
    route("dashboard/social", "routes/dashboard/social.tsx"),
    route("dashboard/courses", "routes/dashboard/courses.tsx"),
    route("dashboard/courses/:courseId", "routes/dashboard/course-detail.tsx"),
  ]),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("logout", "routes/logout.tsx"),
  route("health", "routes/health.ts"),
  route("ready", "routes/ready.ts"),
  // Catch-all: renders the 404 page for any unregistered URL
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
