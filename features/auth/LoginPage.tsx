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
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await authApi.requestOtp(email);
      toast.success("If that email is registered, a code is on its way.");
      setStep("code");
    } catch (err) {
      toast.error(apiError(err, "Couldn't send the code"));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authApi.verifyOtp(email, code);
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

        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-4">
            <label className="block">
              <span className="label">Work email</span>
              <input
                className="input mt-1"
                type="email"
                placeholder="you@keystonecommerce.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </label>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Sending…" : "Email me a login code"}
            </button>
            <p className="text-xs text-muted text-center">
              We'll send a 6-digit code to your email. No password needed.
            </p>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-sm text-muted">
              Enter the 6-digit code sent to <span className="font-medium text-ink">{email}</span>.
            </p>
            <label className="block">
              <span className="label">Login code</span>
              <input
                className="input mt-1 tracking-[0.4em] text-center text-lg"
                inputMode="numeric"
                maxLength={6}
                placeholder="______"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoFocus
              />
            </label>
            <button type="submit" className="btn-primary w-full" disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Sign in"}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="text-muted hover:text-ink"
                onClick={() => {
                  setStep("email");
                  setCode("");
                }}
              >
                ← Change email
              </button>
              <button
                type="button"
                className="text-orange-deep font-medium disabled:opacity-50"
                disabled={busy}
                onClick={() => sendCode(new Event("submit") as unknown as React.FormEvent)}
              >
                Resend code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
