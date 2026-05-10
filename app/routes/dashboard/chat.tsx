import { useEffect, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import {
  MessageCircle,
  Send,
  ShieldCheck,
  Clock,
  Users,
  Lock,
} from "lucide-react";

import type { Route } from "./+types/chat";
import type { ChatMessage } from "~/lib/chat.server";

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
  const { fetchMessages, makePairKey } = await import("~/lib/chat.server");

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

  // If ?with=buddyId is set, verify it's a real buddy and return messages
  const url = new URL(request.url);
  const withId = url.searchParams.get("with");
  let messages: ChatMessage[] = [];

  if (withId && buddies.some((b) => b.id === withId)) {
    const pairKey = makePairKey(user.id, withId);
    messages = await fetchMessages(pairKey);
  }

  return { buddies, messages, userId: user.id };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRemaining(expiresAt: number, now: number): string {
  const ms = expiresAt - now;
  if (ms <= 0) return "expired";
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function initials(displayName: string | null, id: string): string {
  if (displayName) return displayName.slice(0, 2).toUpperCase();
  return id.slice(0, 2).toUpperCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { buddies, messages: initialMessages, userId } = useLoaderData<typeof loader>();

  const [activeBuddyId, setActiveBuddyId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  // Ticking clock for countdown display + expired-message pruning
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetcher for polling messages (also used for initial load per buddy)
  const msgFetcher = useFetcher<typeof loader>();
  const sendFetcher = useFetcher();

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Messages: prefer live fetcher data over initial loader data
  const allMessages = (msgFetcher.data?.messages ?? initialMessages) as ChatMessage[];
  const liveMessages = allMessages.filter((m) => m.expiresAt > now);

  const activeBuddy = buddies.find((b) => b.id === activeBuddyId) ?? null;

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

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveMessages.length]);

  // Focus input when buddy selected
  useEffect(() => {
    if (activeBuddyId) inputRef.current?.focus();
  }, [activeBuddyId]);

  function selectBuddy(id: string) {
    setActiveBuddyId(id);
    setMobileView("chat");
  }

  function handleSend() {
    if (!activeBuddyId || !input.trim() || sendFetcher.state !== "idle") return;
    const fd = new FormData();
    fd.append("buddyId", activeBuddyId);
    fd.append("text", input.trim());
    sendFetcher.submit(fd, { method: "post", action: "/api/chat/send" });
    setInput("");
    // Eagerly reload messages after a short delay to capture the new message
    setTimeout(() => {
      if (activeBuddyId) msgFetcher.load(`/dashboard/chat?with=${activeBuddyId}`);
    }, 300);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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

        {/* Encrypted badge */}
        <div className="mx-4 mb-3 flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5">
          <Lock size={10} className="text-indigo-400" />
          <p className="text-[10px] font-medium text-indigo-500">AES-256-GCM · 3-min TTL</p>
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
                    isActive
                      ? "bg-indigo-50"
                      : "hover:bg-slate-50"
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
            {/* Chat header — sits on white, flush top */}
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
                <div className="flex items-center gap-1">
                  <ShieldCheck size={9} className="text-emerald-500" />
                  <span className="text-[10px] text-slate-400">End-to-end encrypted · vanishes in 3 min</span>
                </div>
              </div>
              {msgFetcher.state !== "idle" && (
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
              )}
            </div>

            {/* Messages — scrollable middle */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
              {liveMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <Lock size={24} className="text-slate-200" />
                  <p className="text-sm text-slate-400">No messages yet.</p>
                  <p className="text-xs text-slate-300">Messages auto-delete after 3 minutes.</p>
                </div>
              ) : (
                liveMessages.map((msg) => {
                  const isOwn = msg.senderId === userId;
                  const remaining = formatRemaining(msg.expiresAt, now);
                  const urgency = msg.expiresAt - now < 30_000;

                  return (
                    <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[72%] flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}>
                        <div
                          className={`rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
                            isOwn
                              ? "rounded-br-sm bg-indigo-600 text-white"
                              : "rounded-bl-sm bg-white text-slate-800 border border-slate-200"
                          }`}
                        >
                          {msg.text}
                        </div>
                        <div className={`flex items-center gap-1.5 px-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                          <span className="text-[10px] text-slate-400">{formatTime(msg.ts)}</span>
                          <span className={`flex items-center gap-0.5 text-[10px] font-medium ${urgency ? "text-red-500 animate-pulse" : "text-slate-400"}`}>
                            <Clock size={8} />
                            {remaining}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
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
                  disabled={!input.trim() || sendFetcher.state !== "idle"}
                  onClick={handleSend}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <MessageCircle size={32} className="text-slate-200" />
            <div>
              <p className="text-sm font-bold text-slate-700">Select a buddy to chat</p>
              <p className="mt-1 text-xs text-slate-400">Messages are encrypted and vanish after 3 minutes.</p>
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
                <span>Keys never stored</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
