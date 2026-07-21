"use client";

import { RequireAuth } from "@/features/auth/RequireAuth";
import { DashboardPage } from "@/features/dashboard/DashboardPage";

export default function Home() {
  return (
    <RequireAuth>
      <DashboardPage />
    </RequireAuth>
  );
}
