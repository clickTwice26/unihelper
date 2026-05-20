import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import {
  MessageCircle,
  Send,
  ShieldCheck,
  Clock,
  Users,
  Lock,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";

import type { Route } from "./+types/chat";
import type { ChatMessage, ChatTransportEnvelope } from "~/lib/chat.server";

export function meta() {
  return [{ title: "Chat | UniBuddy" }];
}

// ── Types ─────────────────────────────────────────────────────────────────────

type BuddyInfo = {
  id: string;
  displayName: string | null;
};

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { db } = await import("~/lib/db.server");
  const { fetchMessages, getTransportKeyHex, makePairKey } = await import("~/lib/chat.server");

  const user = await getAuthenticatedUser(request);
  if (!user) throw redirect("/login");

  // Rate-limit polling — 60 fetches/min per user (every 3s × 3 = comfortable headroom)
  await rateLimit({ key: `chat-poll:${user.id}`, limit: 60, windowSec: 60 });

  // All accepted buddy connections for this user
  const connections = await db.buddyConnection.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    select: {
      userA: { select: { id: true, displayName: true } },
      userB: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const buddies: BuddyInfo[] = connections.map((c) => {
    const other = c.userA.id === user.id ? c.userB : c.userA;
    return { id: other.id, displayName: other.displayName };
  });
  const transportKeys = Object.fromEntries(
    buddies.map((buddy) => {
      const pairKey = makePairKey(user.id, buddy.id);
      return [buddy.id, getTransportKeyHex(pairKey)];
    }),
  );

  // If ?with=buddyId is set, verify it's a real buddy and return messages
  const url = new URL(request.url);
  const withId = url.searchParams.get("with");
  let messages: ChatMessage[] = [];

  if (withId && buddies.some((b) => b.id === withId)) {
    const pairKey = makePairKey(user.id, withId);
    messages = await fetchMessages(pairKey);
  }

  return { buddies, messages, transportKeys, userId: user.id };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(displayName: string | null, id: string): string {
  if (displayName) return displayName.slice(0, 2).toUpperCase();
  return id.slice(0, 2).toUpperCase();
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  if (hex.length % 2 !== 0) throw new Error("Invalid transport key");
  const buffer = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return buffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

const transportEncoder = new TextEncoder();

async function encryptTransportText(text: string, keyHex: string): Promise<ChatTransportEnvelope> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    hexToArrayBuffer(keyHex),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const sealed = new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      transportEncoder.encode(text),
    ),
  );
  const tagLength = 16;
  return {
    iv: bytesToBase64(iv),
    ct: bytesToBase64(sealed.slice(0, sealed.length - tagLength)),
    tag: bytesToBase64(sealed.slice(sealed.length - tagLength)),
  };
}

// ── Demo / privacy scrambler ──────────────────────────────────────────────────

const FAKE_WORDS = [
  "meeting", "tomorrow", "assignment", "lecture", "notes", "campus", "library",
  "study", "project", "deadline", "professor", "exam", "schedule", "review",
  "okay", "sure", "thanks", "great", "sounds", "good", "perfect", "nice",
  "yeah", "maybe", "definitely", "absolutely", "probably", "anyway", "right",
  "homework", "tutorial", "session", "quiz", "seminar", "class", "topic",
  "video", "slides", "reading", "chapter", "concept", "theory", "practice",
];

function hashInt(seed: string, index: number): number {
  let h = 0;
  const s = seed + ":" + index;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function scrambleText(text: string, id: string): string {
  return text
    .split(/\s+/)
    .map((word, i) => {
      const near = FAKE_WORDS.filter((w) => Math.abs(w.length - word.length) <= 2);
      const pool = near.length > 0 ? near : FAKE_WORDS;
      return pool[hashInt(id, i) % pool.length];
    })
    .join(" ");
}

// ── Isolated expiry countdown — owns its own clock so it never re-renders parent ──

const ExpiryTimer = memo(function ExpiryTimer({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ms = expiresAt - now;
  if (ms <= 0) return null;
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const label = m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  const urgency = ms < 30_000;

  return (
    <span
      className={`flex items-center gap-0.5 text-[10px] font-medium ${
        urgency ? "text-red-500 animate-pulse" : "text-slate-400"
      }`}
    >
      <Clock size={8} />
      {label}
    </span>
  );
});

// ── Memoized message bubble — skips re-render unless its own props change ─────

const MessageBubble = memo(function MessageBubble({
  msg,
  isOwn,
  demoMode,
}: {
  msg: ChatMessage;
  isOwn: boolean;
  demoMode: boolean;
}) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[72%] flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
            isOwn
              ? "rounded-br-sm bg-indigo-600 text-white"
              : "rounded-bl-sm bg-white text-slate-800 border border-slate-200"
          }`}
        >
          {demoMode ? scrambleText(msg.text, msg.id) : msg.text}
        </div>
        <div className={`flex items-center gap-1.5 px-1 ${isOwn ? "flex-row-reverse" : ""}`}>
          <span className="text-[10px] text-slate-400">{formatTime(msg.ts)}</span>
          <ExpiryTimer expiresAt={msg.expiresAt} />
        </div>
      </div>
    </div>
  );
});

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { buddies, messages: initialMessages, transportKeys, userId } = useLoaderData<typeof loader>();

  const [activeBuddyId, setActiveBuddyId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [demoMode, setDemoMode] = useState(false);
  const [clearedAt, setClearedAt] = useState<number>(0);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Stable message store: keyed by id so polls only add/update, never replace wholesale
  const [messageMap, setMessageMap] = useState<Map<string, ChatMessage>>(() => {
    const m = new Map<string, ChatMessage>();
    initialMessages.forEach((msg) => m.set(msg.id, msg));
    return m;
  });

  // Slow clock — only used to prune truly expired messages from the list.
  // Per-second countdown display is handled inside ExpiryTimer, isolated from this component.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Fetcher for polling messages (also used for initial load per buddy)
  const msgFetcher = useFetcher<typeof loader>();
  const sendFetcher = useFetcher();

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevCountRef = useRef(0);

  // Merge fetcher results into the stable map — no wholesale replacement
  useEffect(() => {
    const incoming = msgFetcher.data?.messages;
    if (!incoming) return;
    setMessageMap((prev) => {
      // Bail out early if nothing actually changed (same IDs + same content)
      let changed = false;
      for (const msg of incoming) {
        const existing = prev.get(msg.id);
        if (!existing || existing.text !== msg.text) { changed = true; break; }
      }
      if (!changed && incoming.length === prev.size) return prev;

      const next = new Map(prev);
      incoming.forEach((msg) => next.set(msg.id, msg));
      return next;
    });
  }, [msgFetcher.data]);

  // Reset message map when buddy changes
  useEffect(() => {
    setMessageMap(new Map());
    setClearedAt(0);
  }, [activeBuddyId]);

  const liveMessages = useMemo(() => {
    const sorted = Array.from(messageMap.values()).sort((a, b) => a.ts - b.ts);
    return sorted.filter((m) => m.expiresAt > now && m.ts > clearedAt);
  }, [messageMap, now, clearedAt]);

  const activeBuddy = buddies.find((b) => b.id === activeBuddyId) ?? null;
  const activeTransportKey = activeBuddyId ? transportKeys[activeBuddyId] ?? null : null;

  // Load messages when buddy changes
  useEffect(() => {
    if (!activeBuddyId) return;
    msgFetcher.load(`/dashboard/chat?with=${activeBuddyId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBuddyId]);

  // Poll every 3 seconds
  useEffect(() => {
    if (!activeBuddyId) return;
    const id = setInterval(() => {
      msgFetcher.load(`/dashboard/chat?with=${activeBuddyId}`);
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBuddyId]);

  // Scroll to bottom only when a genuinely new message arrives
  useEffect(() => {
    if (liveMessages.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = liveMessages.length;
  }, [liveMessages.length]);

  // Focus input when buddy selected
  useEffect(() => {
    if (activeBuddyId) inputRef.current?.focus();
  }, [activeBuddyId]);

  function selectBuddy(id: string) {
    setActiveBuddyId(id);
    setMobileView("chat");
  }

  async function handleSend() {
    const buddyId = activeBuddyId;
    const text = input.trim();
    const transportKey = buddyId ? transportKeys[buddyId] : null;

    if (!buddyId || !text || !transportKey || sendFetcher.state !== "idle" || isEncrypting) return;

    setIsEncrypting(true);
    setSendError(null);

    try {
      const envelope = await encryptTransportText(text, transportKey);
      const fd = new FormData();
      fd.append("buddyId", buddyId);
      fd.append("iv", envelope.iv);
      fd.append("ct", envelope.ct);
      fd.append("tag", envelope.tag);
      sendFetcher.submit(fd, { method: "post", action: "/api/chat/send" });
      setInput("");
      // Eagerly reload messages after a short delay to capture the new message
      setTimeout(() => {
        msgFetcher.load(`/dashboard/chat?with=${buddyId}`);
      }, 300);
    } catch {
      setSendError("Couldn't encrypt this message. Reload and try again.");
    } finally {
      setIsEncrypting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  // Bleed out of the layout padding so the chat fills the full content area edge-to-edge
  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 flex overflow-hidden"
         style={{ height: "calc(100vh - 4.5rem)" }}>

      {/* ── Buddy list ── */}
      <aside
        className={`flex w-full flex-col border-r border-slate-200 bg-white sm:w-64 sm:flex-shrink-0 ${
          mobileView === "chat" ? "hidden sm:flex" : "flex"
        }`}
      >
        {/* Section label */}
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Users size={14} className="text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Buddies</span>
          <span className="ml-auto text-[10px] text-slate-300">{buddies.length}</span>
        </div>



        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {buddies.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
              <Users size={24} className="text-slate-200" />
              <p className="text-xs text-slate-400">No buddies yet.</p>
              <p className="text-[10px] text-slate-300">Connect via Social first.</p>
            </div>
          ) : (
            buddies.map((buddy) => {
              const isActive = buddy.id === activeBuddyId;
              return (
                <button
                  key={buddy.id}
                  onClick={() => selectBuddy(buddy.id)}
                  className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${
                    isActive ? "bg-indigo-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {initials(buddy.displayName, buddy.id)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold leading-tight ${isActive ? "text-indigo-700" : "text-slate-700"}`}>
                      {buddy.displayName ?? "Unknown"}
                    </p>
                  </div>
                  {isActive && <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Chat area ── */}
      <div
        className={`flex flex-1 flex-col min-w-0 bg-slate-50 ${
          mobileView === "list" ? "hidden sm:flex" : "flex"
        }`}
      >
        {activeBuddy ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
              <button
                type="button"
                className="mr-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 sm:hidden"
                onClick={() => setMobileView("list")}
              >
                ←
              </button>
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                {initials(activeBuddy.displayName, activeBuddy.id)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {activeBuddy.displayName ?? "Unknown"}
                </p>
 
              </div>
              {msgFetcher.state !== "idle" && (
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
              )}
              {/* Demo mode toggle */}
              <button
                type="button"
                onClick={() => setDemoMode((d) => !d)}
                title={demoMode ? "Hide demo chat" : "Show demo chat"}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium transition ${
                  demoMode
                    ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                }`}
              >
                {demoMode ? <EyeOff size={11} /> : <Eye size={11} />}
                {demoMode ? "Demo ON" : "Demo"}
              </button>
              {/* Clear button */}
              <button
                type="button"
                onClick={() => setClearedAt(Date.now())}
                title="Clear all messages"
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-400 transition hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={11} />
                Clear
              </button>
            </div>

            {/* Messages — scrollable middle */}
            <div
              className="flex-1 overflow-y-auto px-5 py-5 space-y-3"
              style={{ overflowAnchor: "auto" }}
            >
              {liveMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <Lock size={24} className="text-slate-200" />
                  <p className="text-sm text-slate-400">No messages yet.</p>
                  <p className="text-xs text-slate-300">Messages auto-delete after 3 minutes.</p>
                </div>
              ) : (
                liveMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isOwn={msg.senderId === userId}
                    demoMode={demoMode}
                  />
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar — white, flush bottom */}
            <div className="border-t border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-indigo-400 focus-within:bg-white transition">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 2000))}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send)"
                  className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
                />
                {input.length > 1800 && (
                  <span className="text-[10px] text-amber-500">{input.length}/2000</span>
                )}
                <button
                  type="button"
                  disabled={!input.trim() || !activeTransportKey || sendFetcher.state !== "idle" || isEncrypting}
                  onClick={() => {
                    void handleSend();
                  }}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
                >
                  <Send size={13} />
                </button>
              </div>
              {sendError ? (
                <p className="mt-2 px-1 text-[11px] text-red-500">{sendError}</p>
              ) : null}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <MessageCircle size={32} className="text-slate-200" />
            <div>
              <p className="text-sm font-bold text-slate-700">Select a buddy to chat</p>
              <p className="mt-1 text-xs text-slate-400">Messages are encrypted before storage and vanish after 3 minutes.</p>
            </div>
            <div className="mt-2 flex flex-col gap-2 text-[11px] text-slate-400 w-full max-w-xs">
              <div className="flex items-center gap-2 rounded-lg bg-white border border-slate-100 px-3 py-2">
                <ShieldCheck size={12} className="text-emerald-500 flex-shrink-0" />
                <span>AES-256-GCM per buddy pair</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white border border-slate-100 px-3 py-2">
                <Clock size={12} className="text-amber-500 flex-shrink-0" />
                <span>Auto-deletes after 3 minutes</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white border border-slate-100 px-3 py-2">
                <Lock size={12} className="text-indigo-400 flex-shrink-0" />
                <span>Pair keys are derived, not persisted</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "~/components/RouteErrorBoundary";
