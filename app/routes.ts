import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("login", "routes/login.tsx"),
	route("register", "routes/register.tsx"),
	route("logout", "routes/logout.tsx"),
	route("health", "routes/health.ts"),
	route("ready", "routes/ready.ts"),
] satisfies RouteConfig;
