"use client";

import { useState } from "react";
import { loginDev } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("demo@verse.local");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await loginDev(email.trim());
      window.location.href = "/chat";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={(e) => void onSubmit(e)}>
        <h1>AT72 Verse</h1>
        <p>Connexion démo (DevAuth). Clerk reste prévu pour plus tard.</p>
        {error ? <div className="error">{error}</div> : null}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
        <button type="submit" disabled={busy}>
          {busy ? "Connexion…" : "Continuer"}
        </button>
      </form>
    </div>
  );
}
