import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, ScanBarcode, FileText, Package, Hash, Users, Truck, ShoppingCart, Receipt,
  UserCog, Settings, LogOut, Sun, Moon, Menu, Bike } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/pos", label: "POS Billing", icon: ScanBarcode },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/items", label: "Parts / Items", icon: Package },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/hsn", label: "HSN & GST", icon: Hash },
  { to: "/suppliers", label: "Suppliers", icon: Truck, admin: true },
  { to: "/purchases", label: "Purchases", icon: ShoppingCart, admin: true },
  { to: "/gst-report", label: "GST Report", icon: Receipt, admin: true },
  { to: "/users", label: "Users", icon: UserCog, admin: true },
  { to: "/settings", label: "Settings", icon: Settings, admin: true },
];

export function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem("mp_theme") !== "light");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("mp_theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark];
}

function NavList({ items, onNav }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={onNav} data-testid={`nav-${to.replace("/", "") || "dashboard"}`}
          className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
            isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          <Icon className="h-4 w-4" /> {label}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand({ name }) {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center"><Bike className="h-5 w-5" /></div>
      <div className="leading-tight min-w-0">
        <div className="font-heading font-extrabold tracking-tight">MotoPOS</div>
        <div className="text-[11px] text-muted-foreground truncate max-w-[150px]">{name}</div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, isAdmin, logout, settings } = useAuth();
  const [dark, setDark] = useTheme();
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const items = NAV.filter((n) => !n.admin || isAdmin);
  const isPrint = /^\/invoices\/.+/.test(loc.pathname);

  const userBox = (
    <div className="border-t pt-3 mt-3 space-y-2">
      <div className="px-2 text-sm"><div className="font-semibold truncate" data-testid="current-user-name">{user.name}</div>
        <div className="label-xs" data-testid="current-user-role">{user.role}</div></div>
      <div className="flex gap-2">
        <button data-testid="theme-toggle-btn" onClick={() => setDark(!dark)} className="flex-1 flex items-center justify-center gap-2 h-9 rounded-md border text-sm hover:bg-accent transition-colors">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {dark ? "Light" : "Dark"}
        </button>
        <button data-testid="logout-btn" onClick={logout} className="flex-1 flex items-center justify-center gap-2 h-9 rounded-md border text-sm hover:bg-destructive hover:text-destructive-foreground transition-colors">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      <aside className="no-print hidden lg:flex w-60 shrink-0 flex-col border-r bg-card p-3 sticky top-0 h-screen">
        <div className="py-2 mb-4"><Brand name={settings.name} /></div>
        <div className="flex-1 overflow-y-auto scroll-thin"><NavList items={items} /></div>
        {userBox}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print lg:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 border-b bg-background/90 backdrop-blur-md">
          <Brand name={settings.name} />
          <button data-testid="mobile-theme-toggle" onClick={() => setDark(!dark)} className="h-9 w-9 grid place-items-center rounded-md border">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>
        <main className={`flex-1 p-4 md:p-6 lg:p-8 ${isPrint ? "" : "pb-24"} lg:pb-8`}><Outlet /></main>
      </div>

      <nav className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 grid grid-cols-5 border-t bg-card">
        {[NAV[0], NAV[1], NAV[2], NAV[3]].map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} data-testid={`bottom-nav-${to.replace("/", "") || "dashboard"}`}
            className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-[10px] font-semibold ${isActive ? "text-primary" : "text-muted-foreground"}`}>
            <Icon className="h-5 w-5" /> {label.split(" ")[0]}
          </NavLink>
        ))}
        <button data-testid="bottom-nav-more" onClick={() => setMore(true)} className="flex flex-col items-center justify-center gap-1 text-[10px] font-semibold text-muted-foreground">
          <Menu className="h-5 w-5" /> More
        </button>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="left" className="w-72 bg-card p-4 flex flex-col">
          <SheetTitle className="mb-4"><Brand name={settings.name} /></SheetTitle>
          <div className="flex-1 overflow-y-auto"><NavList items={items} onNav={() => setMore(false)} /></div>
          {userBox}
        </SheetContent>
      </Sheet>
    </div>
  );
}
