import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Form, Link, NavLink, Outlet, redirect, useLoaderData, useLocation } from "react-router";
import {
  Search,
  Home,
  LayoutDashboard,
  Layers,
  CheckSquare,
  PieChart,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bell,
  BookOpen,
  CalendarDays,
  Globe,
  Menu,
  X,
} from "lucide-react";

import type { Route } from "./+types/dashboard-layout";

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const user = await getAuthenticatedUser(request);

  if (!user) {
    throw redirect("/login");
  }

  return { user };
}

const navItemsSimple = [
  { label: "Home", to: "/dashboard/home", icon: Home, end: true },
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, end: true },
  { label: "Social", to: "/dashboard/social", icon: Globe, end: false },
  { label: "Courses", to: "/dashboard/courses", icon: BookOpen, end: false },
  { label: "Calendar", to: "/dashboard/calendar", icon: CalendarDays, end: false },
  { label: "Projects", to: "/projects", icon: Layers, end: false },
  { label: "Tasks", to: "/tasks", icon: CheckSquare, badge: 10, end: false },
  { label: "Reporting", to: "/reporting", icon: PieChart, end: false },
  { label: "Users", to: "/users", icon: Users, end: false },
];

const footerItems = [
  { label: "Support", to: "/support", icon: HelpCircle },
  { label: "Settings", to: "/settings", icon: Settings },
];

export default function DashboardLayout() {
  const { user } = useLoaderData<typeof loader>();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { pathname } = useLocation();

  const pageTitle = (() => {
    if (pathname === "/dashboard" || pathname === "/dashboard/home") return "Dashboard";
    if (pathname.startsWith("/dashboard/profile")) return "Profile";
    if (pathname.startsWith("/dashboard/social")) return "Social";
    if (pathname.startsWith("/dashboard/courses")) return "Courses";
    if (pathname.startsWith("/dashboard/calendar")) return "Calendar";
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

        {/* Search Input Mock */}
        <div className="px-4 mb-4 mt-2 shrink-0">
            <div className={collapsed ? "lg:hidden" : ""}>
             <div className="relative group">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search" 
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-[0.9rem] text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block">
                  <span className="hidden group-hover:flex items-center justify-center border border-slate-200 rounded px-1.5 py-0.5 text-[0.65rem] font-medium text-slate-400 bg-slate-50">⌘K</span>
                </div>
             </div>
           </div>

           {collapsed ? (
             <div className="hidden lg:flex flex-col items-center gap-2">
               <button
                type="button"
                className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors"
                onClick={() => setCollapsed(false)}
                title="Search"
               >
                  <Search size={20} />
               </button>
               <button
                type="button"
                className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setCollapsed(false)}
                title="Expand sidebar"
               >
                  <ChevronRight size={18} />
               </button>
             </div>
           ) : null}
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

        {/* Feature Card Mock (Used Space) */}
        <div className={collapsed ? "lg:hidden px-4 mb-6" : "px-4 mb-6"}>
          <div className="bg-slate-50 rounded-xl p-4 shadow-sm border border-slate-100 relative">
             <div className="mb-3">
                <span className="flex items-baseline gap-1 text-[0.9rem] font-semibold text-slate-900">
                  Used space
                </span>
             </div>
             <p className="text-[0.8rem] text-slate-500 mb-4 leading-tight">
               Your team has used 80% of your available space. Need more?
             </p>
             {/* Progress bar */}
             <div className="w-full bg-slate-200 rounded-full h-2 mb-4 overflow-hidden">
               <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '80%' }}></div>
             </div>
             <button className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg py-2 shadow-sm hover:bg-slate-50 transition-colors">
                Upgrade plan
             </button>
          </div>
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

          <div className="flex items-center gap-3 sm:gap-4">
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
