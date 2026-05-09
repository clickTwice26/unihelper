import { useEffect, useRef, useState } from "react";
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
  Menu,
  Activity,
  UserPlus
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
  const { pathname } = useLocation();

  const pageTitle = (() => {
    if (pathname === "/dashboard" || pathname === "/dashboard/home") return "Dashboard";
    if (pathname.startsWith("/dashboard/profile")) return "Profile";
    const segment = pathname.split("/").filter(Boolean).pop() ?? "Dashboard";
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  })();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Use user's initials for the fallback avatar.
  const initials = (user.displayName ?? user.email).slice(0, 2).toUpperCase();

  // "Untitled UI" simple format widths.
  const sidebarW = collapsed ? "5rem" : "17.5rem";

  return (
    <div className="dash-shell min-h-screen bg-slate-50 flex">
      {/* ── Sidebar ── */}
      <aside 
        className="fixed inset-y-0 left-0 bg-white border-r border-slate-200 z-30 transition-all duration-300 ease-in-out flex flex-col"
        style={{ width: sidebarW }}
      >
        {/* Brand Header */}
        <div className={`flex items-center h-[4.5rem] shrink-0 transition-opacity px-4 ${collapsed ? "justify-center" : "justify-between px-5"}`}>
          <Link
            to="/"
            className="flex items-center gap-3 overflow-hidden min-w-0"
            aria-label="Untitled UI home"
          >
            <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden bg-white">
              {/* Fake logo representation */}
              <div className="absolute inset-x-0 bottom-0 top-1/2 bg-slate-100" />
              <div className="relative z-10 w-3 h-3 bg-indigo-600 rounded-full" />
            </div>
            {!collapsed && (
              <span className="truncate font-semibold text-slate-900 text-[1.05rem]">
                Untitled UI
              </span>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {/* Search Input Mock */}
        <div className="px-4 mb-4 mt-2 shrink-0">
           {!collapsed ? (
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
           ) : (
             <div className="flex flex-col items-center gap-2">
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
                 } ${collapsed ? "justify-center" : ""}`
               }
               title={collapsed ? item.label : undefined}
             >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <item.icon 
                         size={20} 
                         className={`shrink-0 ${isActive ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700"}`} 
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!collapsed && item.badge && (
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
                 } ${collapsed ? "justify-center" : ""}`
               }
               title={collapsed ? item.label : undefined}
             >
                {({ isActive }) => (
                  <>
                    <item.icon 
                       size={20} 
                       className={`shrink-0 mr-3 ${isActive ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700"} ${collapsed ? "mr-0" : ""}`} 
                    />
                    {!collapsed && (
                       <span className="truncate flex-1">{item.label}</span>
                    )}
                  </>
                )}
             </NavLink>
          ))}
        </div>

        {/* Feature Card Mock (Used Space) */}
        {!collapsed && (
          <div className="px-4 mb-6">
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
        )}

        {/* User Card Row */}
        <div className={`border-t border-slate-200 p-4 flex items-center gap-3 shrink-0 ${collapsed ? "justify-center" : "justify-between"}`}>
           <div className="flex items-center gap-3 min-w-0">
             <div className="h-10 w-10 shrink-0 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-700 shadow-sm overflow-hidden">
                {/* Random avatar image to match Untitled UI vibe if real avatar is absent, here we use initials */}
                {initials}
             </div>
             {!collapsed && (
               <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-[0.9rem] font-semibold text-slate-900 truncate leading-tight">
                    {user.displayName ?? "Olivia Rhye"}
                  </p>
                  <p className="text-[0.8rem] text-slate-500 truncate leading-tight mt-0.5">
                    {user.email}
                  </p>
               </div>
             )}
           </div>

        </div>
      </aside>

      {/* ── Main content area ── */}
      <div 
        className="flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out" 
        style={{ marginLeft: sidebarW }}
      >
        <header className="sticky top-0 z-20 h-[4.5rem] bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-3">
             <span className="text-[1.1rem] font-semibold text-slate-800 tracking-tight">{pageTitle}</span>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-slate-500 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-md transition-colors" aria-label="Notifications">
              <Bell size={20} />
            </button>
            <div className="relative" ref={avatarRef}>
              <button
                type="button"
                onClick={() => setAvatarOpen((o) => !o)}
                className="h-8 w-8 shrink-0 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-700 shadow-sm hover:ring-2 hover:ring-indigo-300 transition-all"
                aria-label="User menu"
                aria-expanded={avatarOpen}
              >
                {initials}
              </button>
              {avatarOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-[0.875rem] font-semibold text-slate-900 truncate">{user.displayName ?? user.email}</p>
                    <p className="text-[0.78rem] text-slate-500 truncate mt-0.5">{user.email}</p>
                  </div>
                  <Link
                    to="/dashboard/profile"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-[0.875rem] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    View profile
                  </Link>
                  <Form action="/logout" method="post">
                    <button
                      type="submit"
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[0.875rem] font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </Form>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
