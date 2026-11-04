"use client";

import { useState, useTransition } from "react";
import { changeRole } from "@/lib/review/actions";
import type { AppRole } from "@/lib/auth/roles";

export function RoleSelect({ userId, role, self }: { userId: string; role: AppRole; self: boolean }) {
  const [value, setValue] = useState(role);
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-2">
      <select
        aria-label="Role"
        value={value}
        disabled={self || pending}
        onChange={(e) => {
          const next = e.currentTarget.value as AppRole;
          if (!window.confirm(`Change role to ${next.replace("_", " ")}?`)) return;
          const prev = value;
          setValue(next);
          start(async () => {
            const r = await changeRole(userId, next);
            setMsg(r.message ?? r.error);
            if (r.error) setValue(prev);
          });
        }}
        className="h-10 rounded-lg border-2 border-input bg-background px-2"
      >
        {["student", "parent", "content_editor", "admin"].map((r) => (
          <option key={r} value={r}>
            {r.replace("_", " ")}
          </option>
        ))}
      </select>
      {msg && <span role="status" className="text-xs">{msg}</span>}
    </span>
  );
}
