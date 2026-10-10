"use client";

import { useEffect, useState } from "react";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/rbac";
import type { Role } from "@prisma/client";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
};

const ROLES: Role[] = [
  "OWNER",
  "EDITOR",
  "FACT_CHECKER",
  "MEDIA_ANALYST",
  "GEO_ANALYST",
  "SOCIAL_PUBLISHER",
  "VIEWER",
];

export default function UserManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "EDITOR" as Role });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/users");
    const json = await res.json();
    if (res.ok) setUsers(json.data.users);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error ?? "تعذر الإنشاء");
      return;
    }
    setMsg(`تم إنشاء المستخدم ${json.data.email}`);
    setForm({ name: "", email: "", password: "", role: "EDITOR" });
    load();
  }

  async function updateRole(id: string, role: Role) {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    load();
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="card grid gap-4 p-5 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-bold">الاسم</span>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">البريد الإلكتروني</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">كلمة المرور</span>
          <input
            required
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">الدور</span>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-2">
          <button className="btn-primary rounded-xl px-6 py-2.5">إنشاء مستخدم</button>
        </div>
        {msg && <p className="md:col-span-2 text-sm text-emerald-300">{msg}</p>}
        {err && <p className="md:col-span-2 text-sm text-rose-300">{err}</p>}
      </form>

      <div className="card overflow-x-auto p-5">
        <table className="w-full text-right text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="p-2">الاسم</th>
              <th className="p-2">البريد</th>
              <th className="p-2">الدور</th>
              <th className="p-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-[var(--border)]">
                <td className="p-2 font-bold">{u.name}</td>
                <td className="p-2 text-[var(--muted)]">{u.email}</td>
                <td className="p-2">
                  <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value as Role)}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <button
                    onClick={() => toggleActive(u.id, !u.active)}
                    className={`chip ${u.active ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    {u.active ? "نشط" : "موقوف"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
