"use client";

import { useState } from "react";
import Overview from "@/components/owner/Overview";
import SectionsManager from "@/components/owner/SectionsManager";
import ContentManager from "@/components/owner/ContentManager";
import ReportsManager from "@/components/owner/ReportsManager";
import AuditLog from "@/components/owner/AuditLog";
import UserManager from "@/components/UserManager";
import PlatformConsole from "@/components/PlatformConsole";

const TABS = [
  { id: "overview", label: "نظرة عامة" },
  { id: "sections", label: "الأقسام" },
  { id: "content", label: "المحتوى" },
  { id: "reports", label: "البلاغات" },
  { id: "users", label: "المستخدمون" },
  { id: "platform", label: "الهوية والصفحات" },
  { id: "audit", label: "سجل النشاط" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** The owner's full control panel, organized as tabs. */
export default function OwnerConsole() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="space-y-6">
      <nav className="card flex flex-wrap gap-1 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              tab === t.id
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--foreground)] hover:bg-[var(--panel)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <Overview />}
      {tab === "sections" && <SectionsManager />}
      {tab === "content" && <ContentManager />}
      {tab === "reports" && <ReportsManager />}
      {tab === "users" && <UserManager />}
      {tab === "platform" && <PlatformConsole />}
      {tab === "audit" && <AuditLog />}
    </div>
  );
}
