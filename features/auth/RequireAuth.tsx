"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

/** Client-side guard: redirects to /login when there's no access token. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [accessToken, router]);

  if (!accessToken || !checked) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted">Loading…</div>;
  }
  return <>{children}</>;
}
