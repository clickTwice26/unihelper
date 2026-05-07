import { createCookie } from "react-router";

const flashCookie = createCookie("unihelper_flash", {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60,
});

export async function serializeFlash(message: string) {
  return flashCookie.serialize(message);
}

export async function parseFlash(request: Request): Promise<string | null> {
  const value = await flashCookie.parse(request.headers.get("Cookie"));
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function clearFlash() {
  return flashCookie.serialize("", { maxAge: 0 });
}
