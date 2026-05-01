"use client";

import { LockKeyhole, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/client-api";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@kiju.local");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-icon">
          <LockKeyhole size={34} aria-hidden />
        </div>
        <div>
          <p className="eyebrow">KiJu Lager</p>
          <h1>Anmelden</h1>
        </div>
        <label className="field">
          <span>E-Mail</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label className="field">
          <span>Passwort</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
          />
        </label>
        {error ? <div className="status error">{error}</div> : null}
        <button className="primary-action" disabled={busy}>
          <LogIn size={20} aria-hidden />
          {busy ? "Anmelden..." : "Anmelden"}
        </button>
      </form>
    </main>
  );
}
