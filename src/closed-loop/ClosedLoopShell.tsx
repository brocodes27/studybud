import { ReactNode, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpenCheck,
  Brain,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  Settings2,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export type Experience =
  | "student"
  | "teacher"
  | "parent"
  | "principal"
  | "chain"
  | "admin";

const navByExperience: Record<
  Experience,
  Array<{ to: string; label: string; icon: typeof Home }>
> = {
  student: [
    { to: "/", label: "Today", icon: Home },
    { to: "/atlas", label: "Atlas", icon: Brain },
    { to: "/session", label: "Guided session", icon: Sparkles },
  ],
  teacher: [
    { to: "/teacher", label: "Command center", icon: ClipboardCheck },
    { to: "/teacher/grader", label: "Notebook grader", icon: BookOpenCheck },
  ],
  parent: [{ to: "/parent", label: "Daily digest", icon: Users }],
  principal: [
    { to: "/principal", label: "Outcomes", icon: BarChart3 },
    { to: "/school-setup", label: "School setup", icon: Settings2 },
  ],
  chain: [
    { to: "/chain", label: "Chain overview", icon: Building2 },
    { to: "/principal", label: "Campus outcomes", icon: BarChart3 },
    { to: "/school-setup", label: "School setup", icon: Settings2 },
  ],
  admin: [
    { to: "/admin", label: "Platform admin", icon: Shield },
    { to: "/chain", label: "Chains", icon: Building2 },
    { to: "/principal", label: "Outcomes", icon: BarChart3 },
    { to: "/school-setup", label: "School setup", icon: Settings2 },
  ],
};

export function resolveExperience(
  role: string | null,
  accountType: string | null,
  isAdmin: boolean,
  isChainAdmin = false,
): Experience {
  if (isAdmin) return "admin";
  if (isChainAdmin || String(role || "").toLowerCase() === "chain_admin")
    return "chain";
  const value = String(role || accountType || "student").toLowerCase();
  if (value === "teacher") return "teacher";
  if (value === "parent") return "parent";
  if (["org_admin", "principal", "school_admin"].includes(value))
    return "principal";
  return "student";
}

export function ClosedLoopShell({ children }: { children: ReactNode }) {
  const {
    role,
    accountType,
    isAdmin,
    isChainAdmin,
    fullName,
    signOut,
    accessibleSchools,
    schoolId,
    setActiveSchoolId,
  } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const experience = useMemo(
    () => resolveExperience(role, accountType, isAdmin, isChainAdmin),
    [role, accountType, isAdmin, isChainAdmin],
  );
  const nav = navByExperience[experience];
  const isFocusWorkspace = ["/session", "/atlas"].includes(location.pathname);
  const isFullscreen =
    new URLSearchParams(location.search).get("fullscreen") === "1";
  const showCampusSwitcher =
    (experience === "chain" ||
      experience === "admin" ||
      experience === "principal") &&
    accessibleSchools.length > 1;

  if (isFullscreen) {
    return (
      <div className="h-screen overflow-hidden bg-[var(--neo-bg)] text-[var(--neo-ink)]">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--neo-bg)] text-[var(--neo-ink)]">
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-stone-200/70 bg-[var(--neo-bg)]/90 px-4 backdrop-blur-xl md:hidden">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--neo-ink)] text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          Elevenfolks
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="rounded-xl border border-stone-200 bg-white p-2"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </header>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-stone-950/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-stone-200/70 bg-white/92 p-3 shadow-sm backdrop-blur-xl transition-[width,transform] duration-300 ${
          collapsed ? "md:w-20" : "md:w-64"
        } ${mobileOpen ? "w-72 translate-x-0" : "w-72 -translate-x-full md:translate-x-0"}`}
      >
        <div className="flex h-14 items-center justify-between px-2">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--neo-ink)] text-white shadow-lg shadow-stone-900/10">
              <GraduationCap className="h-5 w-5" />
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">Elevenfolks</p>
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--neo-muted)]">
                  Learning loop
                </p>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="hidden rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 md:block"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="mt-6 flex-1 space-y-1.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition-all ${
                  isActive
                    ? "bg-[var(--neo-ink)] text-white shadow-md shadow-stone-900/10"
                    : "text-stone-500 hover:bg-[var(--neo-surface)] hover:text-stone-900"
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>

        {!collapsed && showCampusSwitcher && (
          <div className="mb-3 rounded-2xl border border-stone-200 bg-[var(--neo-surface)] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--neo-muted)]">
              Active campus
            </p>
            <select
              className="neo-input mt-2 w-full text-xs"
              value={schoolId || ""}
              onChange={(event) => {
                void setActiveSchoolId(event.target.value || null).catch(
                  () => undefined,
                );
              }}
            >
              {accessibleSchools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!collapsed && (
          <div className="mb-2 rounded-2xl bg-[var(--neo-surface)] p-3">
            <p className="truncate text-sm font-bold">
              {fullName || "Your workspace"}
            </p>
            <p className="mt-0.5 text-xs capitalize text-[var(--neo-muted)]">
              {experience}
            </p>
            <button
              type="button"
              onClick={() => signOut()}
              className="mt-3 flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-900"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        )}
      </aside>

      <main
        className={`min-h-screen pt-16 transition-[padding] duration-300 md:pt-0 ${
          collapsed ? "md:pl-20" : "md:pl-64"
        } ${isFocusWorkspace ? "h-screen overflow-hidden" : ""}`}
      >
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-stone-200/70 pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--neo-accent)]">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--neo-muted)] sm:text-base">
          {description}
        </p>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
