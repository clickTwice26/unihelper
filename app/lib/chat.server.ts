/**
 * chat.server.ts — Server-managed encrypted ephemeral chat
 *
 * Security model:
 *  - Every buddy pair has deterministic AES keys derived from SESSION_SECRET.
 *  - The browser encrypts outbound message text before POSTing it to the API.
 *  - The server decrypts that transport payload, then re-encrypts the full message
 *    payload for Redis as one AES-256-GCM blob with a random 12-byte IV.
 *  - Redis stores ONLY { iv, ct, tag } — no plaintext field of any kind.
 *  - The sorted-set score is `expiresAt` (unix ms) — a bare number with no content,
 *    required so ZREMRANGEBYSCORE can prune expired entries server-side.
 *  - Messages expire after CHAT_TTL_SECONDS; the Redis key itself expires 1 h after
 *    last activity.
 */

import crypto from "node:crypto";
import { redis } from "~/lib/redis.server";
import { env } from "~/lib/env.server";

export const CHAT_TTL_SECONDS = 180; // 3 minutes per message
export const CHAT_MAX_LENGTH = 2000; // characters
export type ChatTransportEnvelope = { iv: string; ct: string; tag: string };

// ── Key derivation ────────────────────────────────────────────────────────────

/** Returns a 32-byte AES-256 key unique to this buddy pair. Never stored. */
function roomEncKey(pairKey: string): Buffer {
  return crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(`unibuddy:chat:${pairKey}`)
    .digest(); // 32 bytes
}

function roomTransportKey(pairKey: string): Buffer {
  return crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(`unibuddy:chat:transport:${pairKey}`)
    .digest(); // 32 bytes
}

export function getTransportKeyHex(pairKey: string): string {
  return roomTransportKey(pairKey).toString("hex");
}

export function decryptTransportText(envelope: ChatTransportEnvelope, pairKey: string): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    roomTransportKey(pairKey),
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ct, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// ── Encryption helpers ────────────────────────────────────────────────────────

type StoredEnvelope = { iv: string; ct: string; tag: string };

function encrypt(plaintext: string, key: Buffer): StoredEnvelope {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("hex"),
    ct: ct.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
  };
}

function decrypt(envelope: StoredEnvelope, key: Buffer): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "hex"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ct, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  ts: number;        // unix ms — when sent
  expiresAt: number; // unix ms — when it disappears
};

// ── Public API ────────────────────────────────────────────────────────────────

/** Canonical pair key — must match the value stored in BuddyConnection.pairKey in the DB.
 *  cuid IDs never contain ":", so collision is not possible with the current ID scheme.
 */
export function makePairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

/** Maximum messages kept per room at any time. Oldest are evicted first. */
const CHAT_MAX_ROOM_MESSAGES = 200;

/**
 * Encrypts the ENTIRE message payload (id, senderId, text, ts, expiresAt) as a
 * single AES-256-GCM blob and stores only { iv, ct, tag } in Redis.
 * No plaintext field is written to Redis at any point.
 * Caps the room at CHAT_MAX_ROOM_MESSAGES; evicts lowest-score (oldest) entries.
 */
export async function storeMessage(
  pairKey: string,
  senderId: string,
  text: string,
): Promise<void> {
  const key = roomEncKey(pairKey);
  const id = crypto.randomUUID();
  const ts = Date.now();
  const expiresAt = ts + CHAT_TTL_SECONDS * 1000;

  // Encrypt the whole inner payload — nothing leaks into Redis
  const innerJson = JSON.stringify({ id, senderId, text, ts, expiresAt });
  const envelope = encrypt(innerJson, key);

  // Only the opaque envelope is persisted; score is a bare unix-ms number
  const member = JSON.stringify(envelope);
  const redisKey = `chat:${pairKey}`;

  await redis.zadd(redisKey, expiresAt, member);
  // Evict oldest messages beyond the per-room cap (removes lowest scores first)
  await redis.zremrangebyrank(redisKey, 0, -(CHAT_MAX_ROOM_MESSAGES + 1));
  // Keep the sorted-set alive for 1 h after last activity
  await redis.expire(redisKey, 3600);
}

/**
 * Prunes expired entries then decrypts each remaining member.
 * The full inner payload is recovered only in memory, never re-persisted.
 * Entries that fail decryption (tampered / wrong key) are silently dropped.
 */
export async function fetchMessages(pairKey: string): Promise<ChatMessage[]> {
  const key = roomEncKey(pairKey);
  const redisKey = `chat:${pairKey}`;
  const now = Date.now();

  // Remove members whose score (expiresAt) ≤ now
  await redis.zremrangebyscore(redisKey, "-inf", now);

  const raw = await redis.zrange(redisKey, 0, -1);
  const messages: ChatMessage[] = [];

  for (const member of raw) {
    try {
      const envelope = JSON.parse(member) as StoredEnvelope;
      const innerJson = decrypt(envelope, key);
      const inner = JSON.parse(innerJson) as ChatMessage;
      messages.push(inner);
    } catch {
      // Corrupted or tampered entry — silently discard
    }
  }

  return messages;
}
