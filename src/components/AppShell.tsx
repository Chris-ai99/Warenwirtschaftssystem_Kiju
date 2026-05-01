"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun, Warehouse } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import type { CurrentUser } from "@/lib/auth";

type Props = {
  user: CurrentUser;
  children: React.ReactNode;
};

export function AppShell({ user, children }: Props) {
  const router = useRouter();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = stored ? stored === "dark" : prefersDark;
    setDark(shouldUseDark);
    document.documentElement.dataset.theme = shouldUseDark ? "dark" : "light";
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.dataset.theme = next ? "dark" : "light";
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Startseite">
          <Warehouse size={24} aria-hidden />
          <span>KiJu Lager</span>
        </Link>
        <div className="topbar-actions">
          <span className="user-chip">{user.name}</span>
          <button className="icon-button" onClick={toggleTheme} aria-label="Darstellung wechseln">
            {dark ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
          </button>
          <button className="icon-button" onClick={logout} aria-label="Abmelden">
            <LogOut size={20} aria-hidden />
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
