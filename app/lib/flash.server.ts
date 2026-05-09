import { createCookie } from "react-router";

const flashCookie = createCookie("unihelper_flash", {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60,
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
