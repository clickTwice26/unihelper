import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/marketing-layout.tsx", [
    index("routes/home.tsx"),
  ]),
  layout("routes/dashboard-layout.tsx", [
    route("dashboard", "routes/dashboard/home.tsx"),
    route("dashboard/profile", "routes/dashboard/profile.tsx"),
    route("dashboard/social", "routes/dashboard/social.tsx"),
    route("dashboard/courses", "routes/dashboard/courses.tsx"),
    route("dashboard/courses/:courseId", "routes/dashboard/course-detail.tsx"),
    route("dashboard/courses/:courseId/files/:fileId", "routes/dashboard/course-file.tsx"),
    route("dashboard/calendar", "routes/dashboard/calendar.tsx"),
    route("dashboard/routine", "routes/dashboard/routine.tsx"),
    route("dashboard/tasks", "routes/dashboard/tasks.tsx"),
    route("dashboard/expenses", "routes/dashboard/expenses.tsx"),
    route("dashboard/health", "routes/dashboard/health.tsx"),
  ]),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("logout", "routes/logout.tsx"),
  route("api/search", "routes/api.search.ts"),
  route("health", "routes/health.ts"),
  route("ready", "routes/ready.ts"),
  // Catch-all: renders the 404 page for any unregistered URL
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
