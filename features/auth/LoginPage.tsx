"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { apiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";

export function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState("admin@keystonecommerce.in");
  const [password, setPassword] = useState("admin123");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authApi.login(email, password);
      setSession(res);
      router.replace("/");
    } catch (err) {
      toast.error(apiError(err, "Sign-in failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-keystone bg-orange text-white grid place-items-center font-bold">
            K
          </div>
          <div>
            <div className="text-xs tracking-widest text-muted">KEYSTONE COMMERCE</div>
            <div className="text-base font-semibold">Vendor Dashboard</div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="label">Email</span>
            <input
              className="input mt-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input
              className="input mt-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-xs text-muted text-center">
            Seed credentials: admin@keystonecommerce.in / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
