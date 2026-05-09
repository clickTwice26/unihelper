import { createCookie } from "react-router";

import { env } from "~/lib/env.server";

const flashCookie = createCookie("unihelper_flash", {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60,
  secure: env.NODE_ENV === "production",
  secrets: [env.SESSION_SECRET],
});

export type FlashMessage = {
  type: "success" | "error" | "warning";
  message: string;
};

export async function serializeFlash(flash: FlashMessage) {
  return flashCookie.serialize(JSON.stringify(flash));
}

export async function parseFlash(request: Request): Promise<FlashMessage | null> {
  const raw = await flashCookie.parse(request.headers.get("Cookie"));
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.type === "string" && typeof parsed.message === "string") {
      return parsed as FlashMessage;
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearFlash() {
  return flashCookie.serialize("", { maxAge: 0 });
}
