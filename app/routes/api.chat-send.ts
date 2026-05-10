import type { Route } from "./+types/api.chat-send";

export async function action({ request }: Route.ActionArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { db } = await import("~/lib/db.server");
  const { storeMessage, makePairKey, CHAT_MAX_LENGTH } = await import("~/lib/chat.server");

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const user = await getAuthenticatedUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  await rateLimit({ key: `chat-send:${user.id}`, limit: 30, windowSec: 60 });

  const formData = await request.formData();
  const buddyId = String(formData.get("buddyId") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();

  if (!buddyId || !text) {
    return new Response("Bad Request", { status: 400 });
  }

  if (text.length > CHAT_MAX_LENGTH) {
    return new Response("Message too long", { status: 400 });
  }

  // Verify the two users are actually accepted buddies — server constructs the pairKey
  const pairKey = makePairKey(user.id, buddyId);
  const connection = await db.buddyConnection.findUnique({ where: { pairKey } });
  if (!connection) {
    return new Response("Forbidden", { status: 403 });
  }

  await storeMessage(pairKey, user.id, text);
  return new Response("ok", { status: 200 });
}
