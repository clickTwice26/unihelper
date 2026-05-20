import type { ChatTurn } from "~/lib/warden-ai.server";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { db } = await import("~/lib/db.server");
  const { buildUserContext, callWardenAI } = await import("~/lib/warden-ai.server");

  const user = await getAuthenticatedUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    await rateLimit({ key: `warden-ai:${user.id}`, limit: 10, windowSec: 60 });
  } catch (err) {
    if (err instanceof Response && err.status === 429) {
      return Response.json(
        { error: "Rate limit reached. Please wait a moment before sending another message." },
        { status: 429 },
      );
    }
    throw err;
  }

  let message: string;
  let history: ChatTurn[];

  try {
    const formData = await request.formData();
    message = String(formData.get("message") ?? "").trim().slice(0, 1000);
    const historyRaw = String(formData.get("history") ?? "[]");
    const parsed: unknown = JSON.parse(historyRaw);
    if (!Array.isArray(parsed)) throw new Error("history not array");
    // Validate + cap at last 10 turns
    history = (parsed as Array<{ role: string; text: string }>)
      .slice(-10)
      .filter((t) => (t.role === "user" || t.role === "model") && typeof t.text === "string")
      .map((t) => ({ role: t.role as "user" | "model", text: t.text.slice(0, 2000) }));
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!message) {
    return Response.json({ error: "Message cannot be empty." }, { status: 400 });
  }

  try {
    const context = await buildUserContext(user.id, db);
    const reply = await callWardenAI({ userMessage: message, history, context });
    return Response.json({ reply });
  } catch (err) {
    console.error("[warden-chat] Gemini error:", err);
    return Response.json(
      { error: "The AI is temporarily unavailable. Please try again in a moment." },
      { status: 500 },
    );
  }
}
