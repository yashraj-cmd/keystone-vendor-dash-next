"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

/**
 * Client-side guard: redirects to /login when there's no access token.
 *
 * The auth store is persisted to localStorage, but zustand rehydrates it
 * asynchronously — so on a page refresh the token is briefly null before it
 * loads back in. We must wait for hydration to finish before deciding, or we'd
 * bounce a logged-in user to /login on every refresh.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Mark hydrated once the persisted store has loaded (or immediately if it
    // already had by the time this effect ran).
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    if (hydrated && !accessToken) {
      router.replace("/login");
    }
  }, [hydrated, accessToken, router]);

  if (!hydrated || !accessToken) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted">Loading…</div>;
  }
  return <>{children}</>;
}
