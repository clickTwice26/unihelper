import { data } from "react-router";

// Catch-all route — throws a proper 404 Response so the root ErrorBoundary
// renders the styled 404 page instead of crashing with a hard server error.
export function loader() {
  throw data(null, { status: 404, statusText: "Not Found" });
}

export default function NotFound() {
  return null;
}
