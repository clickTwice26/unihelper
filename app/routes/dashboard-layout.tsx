import { type CSSProperties, type ComponentType, useEffect, useRef, useState } from "react";
import { Form, Link, NavLink, Outlet, redirect, useFetcher, useLoaderData, useLocation, useNavigate } from "react-router";
import {
  Search,
  LayoutDashboard,
  LayoutGrid,
  CheckSquare,
  Wallet,
  LogOut,
  ChevronLeft,
  Bell,
  BookOpen,
  CalendarDays,
  Globe,
  Menu,
  X,
  HeartPulse,
  HardDrive,
  FileText,
  Loader2,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";

import type { Route } from "./+types/dashboard-layout";

// ── Global Search ─────────────────────────────────────────────────────────────

type SearchResult = {
  id: string;
  type: "course" | "file" | "task" | "routine";
  title: string;
  subtitle: string;
  href: string;
  ownerLabel: string | null;
};

const SEARCH_TYPE_CONFIG: Record<
  SearchResult["type"],
  { label: string; icon: ComponentType<{ size?: number; className?: string }> }
> = {
  course:  { label: "Courses",          icon: BookOpen   },
  file:    { label: "Files & Storage",  icon: FileText   },
  task:    { label: "Tasks",            icon: CheckSquare },
  routine: { label: "Routine",          icon: LayoutGrid },
};

function groupSearchResults(results: SearchResult[]) {
  const order: SearchResult["type"][] = ["course", "file", "task", "routine"];
  const map = new Map<string, SearchResult[]>();
  for (const r of results) {
    const arr = map.get(r.type) ?? [];
    arr.push(r);
    map.set(r.type, arr);
  }
  return order
    .filter((t) => map.has(t))
    .map((t) => ({ type: t, ...SEARCH_TYPE_CONFIG[t], items: map.get(t)! }));
}

function GlobalSearch() {
  const fetcher = useFetcher<SearchResult[]>();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;
  const isSearching = fetcher.state !== "idle";
  const results: SearchResult[] = hasQuery && Array.isArray(fetcher.data) ? fetcher.data : [];
  const showDropdown = open && hasQuery;

  // Debounced search — fire 280ms after the user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!hasQuery) { setOpen(false); return; }
    debounceRef.current = setTimeout(() => {
      fetcher.load(`/api/search?q=${encodeURIComponent(trimmed)}`);
      setOpen(true);
      setActiveIdx(-1);
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Close on outside click
  useEffect(() => {
    if (!showDropdown) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  // ⌘K / Ctrl+K to focus
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); return; }
    if (!showDropdown || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      const r = results[activeIdx];
      if (r) { navigate(r.href); setOpen(false); setQuery(""); }
    }
  }

  const grouped = groupSearchResults(results);

  return (
    <div ref={containerRef} className="hidden sm:flex flex-1 max-w-sm mx-6 relative">
      <div className="relative w-full">
        {isSearching ? (
          <Loader2 size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin pointer-events-none" />
        ) : (
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => { if (hasQuery) setOpen(true); }}
          placeholder="Search… (⌘K)"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {isSearching ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
              <Loader2 size={13} className="animate-spin" />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400">
              No results for{" "}
              <span className="font-medium text-slate-600">"{trimmed}"</span>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto py-1">
              {grouped.map(({ type, label, icon: Icon, items }) => (
                <div key={type}>
                  <p className="px-3 pt-2.5 pb-1 text-[0.62rem] font-bold uppercase tracking-widest text-slate-400">
                    {label}
                  </p>
                  {items.map((r) => {
                    const flatIdx = results.indexOf(r);
                    const isActive = flatIdx === activeIdx;
                    return (
                      <Link
                        key={r.id}
                        to={r.href}
                        onClick={() => { setOpen(false); setQuery(""); }}
                        className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                          isActive ? "bg-indigo-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <Icon size={14} className="shrink-0 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                          <p className="truncate text-xs text-slate-400">{r.subtitle}</p>
                        </div>
                        {r.ownerLabel ? (
                          <span className="shrink-0 rounded-full border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[0.6rem] font-bold text-indigo-600">
                            {r.ownerLabel}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const user = await getAuthenticatedUser(request);

  if (!user) {
    throw redirect("/login");
  }

  const { db } = await import("~/lib/db.server");
  const now = new Date();

  const courseIds = (await db.course.findMany({
    where: { ownerId: user.id, deletedAt: null },
    select: { id: true },
  })).map((c) => c.id);

  let wardenAlertCount = 0;
  if (courseIds.length > 0) {
    const day3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const day7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [quizCount, assignCount, midCount, finalCount, presCount] = await Promise.all([
      db.quiz.count({ where: { courseId: { in: courseIds }, quizDate: { gte: now, lte: day3 } } }),
      db.assignment.count({ where: { courseId: { in: courseIds }, deadline: { gte: now, lte: day3 } } }),
      db.midExam.count({ where: { courseId: { in: courseIds }, examDate: { gte: now, lte: day7 } } }),
      db.finalExam.count({ where: { courseId: { in: courseIds }, examDate: { gte: now, lte: day7 } } }),
      db.presentation.count({ where: { courseId: { in: courseIds }, presentationDate: { gte: now, lte: day7 } } }),
    ]);
    wardenAlertCount = quizCount + assignCount + midCount + finalCount + presCount;
  }

  return { user, wardenAlertCount };
}

const navItemsSimple: Array<{
  label: string;
  to: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  end: boolean;
  badge?: string;
}> = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, end: true },
  { label: "Social", to: "/dashboard/social", icon: Globe, end: false },
  { label: "Courses", to: "/dashboard/courses", icon: BookOpen, end: false },
  { label: "Calendar", to: "/dashboard/calendar", icon: CalendarDays, end: false },
  { label: "Routine", to: "/dashboard/routine", icon: LayoutGrid, end: false },
  { label: "Tasks", to: "/dashboard/tasks", icon: CheckSquare, end: false },
  { label: "Expenses", to: "/dashboard/expenses", icon: Wallet, end: false },
  { label: "Health", to: "/dashboard/health", icon: HeartPulse, end: false },
  { label: "Storage", to: "/dashboard/storage", icon: HardDrive, end: false },
  { label: "Chat", to: "/dashboard/chat", icon: MessageCircle, end: false },
  { label: "Warden", to: "/dashboard/warden", icon: ShieldCheck, end: false },
];

const footerItems: Array<{
  label: string;
  to: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}> = [];

export default function DashboardLayout() {
  const { user, wardenAlertCount } = useLoaderData<typeof loader>();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { pathname } = useLocation();

  const pageTitle = (() => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname.startsWith("/dashboard/profile")) return "Profile";
    if (pathname.startsWith("/dashboard/social")) return "Social";
    if (pathname.startsWith("/dashboard/courses")) return "Courses";
    if (pathname.startsWith("/dashboard/calendar")) return "Calendar";
    if (pathname.startsWith("/dashboard/routine")) return "Routine";
    if (pathname.startsWith("/dashboard/tasks")) return "Tasks";
    if (pathname.startsWith("/dashboard/expenses")) return "Expenses";
    if (pathname.startsWith("/dashboard/health")) return "Health Tracker";
    if (pathname.startsWith("/dashboard/storage")) return "Storage";
    if (pathname.startsWith("/dashboard/chat")) return "Chat";
    if (pathname.startsWith("/dashboard/warden")) return "Warden";
    const segment = pathname.split("/").filter(Boolean).pop() ?? "Dashboard";
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  })();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!avatarOpen) return;
    function onDocClick(e: MouseEvent) {
      if (avatarWrapRef.current && !avatarWrapRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    // setTimeout(0): skip the current click that opened the dropdown
    // before registering the outside-click listener
    const id = window.setTimeout(() => document.addEventListener("click", onDocClick), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", onDocClick);
    };
  }, [avatarOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);
  
  // Use user's initials for the fallback avatar.
  const initials = (user.displayName ?? user.email).slice(0, 2).toUpperCase();

  // "UniBuddy" simple format widths.
  const desktopSidebarW = collapsed ? "5rem" : "17.5rem";
  const sidebarStyle = { "--sidebar-w": desktopSidebarW } as CSSProperties;

  return (
    <div className="dash-shell min-h-screen bg-slate-50 lg:flex">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      {/* ── Sidebar ── */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 flex w-[17.5rem] flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out lg:w-[var(--sidebar-w)] lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={sidebarStyle}
      >
        {/* Brand Header */}
        <div
          className={`flex h-[4.5rem] shrink-0 items-center justify-between px-5 transition-opacity ${
            collapsed ? "lg:justify-center lg:px-4" : ""
          }`}
        >
          <Link
            to="/"
            className="flex items-center gap-3 overflow-hidden min-w-0"
            aria-label="UniBuddy home"
            onClick={() => setMobileNavOpen(false)}
          >
            <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden bg-white">
              {/* Fake logo representation */}
              <div className="absolute inset-x-0 bottom-0 top-1/2 bg-slate-100" />
              <div className="relative z-10 w-3 h-3 bg-indigo-600 rounded-full" />
            </div>
            <span
              className={`truncate font-semibold text-slate-900 text-[1.05rem] ${
                collapsed ? "lg:hidden" : ""
              }`}
            >
              UniBuddy
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="hidden shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 lg:block"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {/* Primary Nav List */}
        <nav className="flex-1 overflow-y-auto px-4 space-y-1 mt-2" aria-label="Dashboard navigation">
           {navItemsSimple.map((item) => (
             <NavLink
               key={item.label}
               to={item.to}
               end={item.end}
               className={({ isActive }) =>
                 `group flex items-center justify-between px-3 py-2 rounded-md transition-colors text-[0.95rem] font-semibold ${
                   isActive 
                     ? "bg-slate-100 text-slate-900" 
                     : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                 } ${collapsed ? "lg:justify-center" : ""}`
               }
               title={collapsed ? item.label : undefined}
               onClick={() => setMobileNavOpen(false)}
             >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <item.icon 
                         size={20} 
                         className={`shrink-0 ${isActive ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700"}`} 
                      />
                      <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
             </NavLink>
           ))}
        </nav>

        {/* Footer Nav List */}
        <div className="px-4 mt-auto space-y-1 mb-6">
          {footerItems.map((item) => (
             <NavLink
               key={item.label}
               to={item.to}
               className={({ isActive }) =>
                 `group flex items-center px-3 py-2 rounded-md transition-colors text-[0.95rem] font-semibold ${
                   isActive 
                     ? "bg-slate-100 text-slate-900" 
                     : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                 } ${collapsed ? "lg:justify-center" : ""}`
               }
               title={collapsed ? item.label : undefined}
               onClick={() => setMobileNavOpen(false)}
             >
                {({ isActive }) => (
                  <>
                    <item.icon 
                       size={20} 
                       className={`shrink-0 mr-3 ${isActive ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700"} ${collapsed ? "mr-0" : ""}`} 
                    />
                    <span className={`truncate flex-1 ${collapsed ? "lg:hidden" : ""}`}>
                      {item.label}
                    </span>
                  </>
                )}
             </NavLink>
          ))}
        </div>


        {/* User Card Row */}
        <div className={`border-t border-slate-200 p-4 flex items-center gap-3 shrink-0 justify-between ${collapsed ? "lg:justify-center" : ""}`}>
           <div className="flex items-center gap-3 min-w-0">
             <div className="h-10 w-10 shrink-0 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-700 shadow-sm overflow-hidden">
                {/* Random avatar image to match Untitled UI vibe if real avatar is absent, here we use initials */}
                {initials}
             </div>
             <div className={`flex-1 min-w-0 flex flex-col justify-center ${collapsed ? "lg:hidden" : ""}`}>
                <p className="text-[0.9rem] font-semibold text-slate-900 truncate leading-tight">
                  {user.displayName ?? "Olivia Rhye"}
                </p>
                <p className="text-[0.8rem] text-slate-500 truncate leading-tight mt-0.5">
                  {user.email}
                </p>
             </div>
           </div>

        </div>
      </aside>

      {/* ── Main content area ── */}
      <div 
        className="flex min-h-screen flex-1 flex-col transition-all duration-300 ease-in-out lg:ml-[var(--sidebar-w)]" 
        style={sidebarStyle}
      >
        <header className="sticky top-0 z-20 flex h-[4.5rem] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
             <button
               type="button"
               onClick={() => setMobileNavOpen(true)}
               className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden"
               aria-label="Open sidebar"
             >
               <Menu size={20} />
             </button>
             <span className="text-[1rem] font-semibold text-slate-800 tracking-tight sm:text-[1.1rem]">{pageTitle}</span>
          </div>

          {/* Search bar */}
          <GlobalSearch />

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/dashboard/warden"
              className={`relative inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                pathname.startsWith("/dashboard/warden")
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
              aria-label="Warden"
            >
              <ShieldCheck size={17} className="shrink-0" />
              <span className="hidden sm:inline">Warden</span>
              {wardenAlertCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {wardenAlertCount > 9 ? "9+" : wardenAlertCount}
                </span>
              )}
            </Link>
            <button className="text-slate-500 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-md transition-colors" aria-label="Notifications">
              <Bell size={20} />
            </button>
            <div className="relative" ref={avatarWrapRef}>
              {/* Avatar trigger button */}
              <button
                type="button"
                onClick={() => setAvatarOpen((o) => !o)}
                className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white ring-2 ring-white hover:ring-indigo-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Open user menu"
                aria-haspopup="true"
                aria-expanded={avatarOpen}
              >
                {initials}
              </button>

              {/* Dropdown panel */}
              {avatarOpen && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden" style={{ zIndex: 9999 }}>
                  {/* User info header */}
                  <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {user.displayName ?? user.email}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      to="/dashboard/profile"
                      onClick={() => setAvatarOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                       View profile
                    </Link>
                  </div>

                  {/* Sign out */}
                  <div className="border-t border-slate-100 p-2">
                    <Form action="/logout" method="post">
                      <button
                        type="submit"
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <LogOut size={15} className="text-slate-400" />
                        Sign out
                      </button>
                    </Form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
