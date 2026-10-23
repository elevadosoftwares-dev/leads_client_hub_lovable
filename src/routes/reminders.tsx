import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Eye } from "lucide-react";
import { AppShell, Card, IconBtn, PageHeader, SearchBox, TypeBadge } from "@/components/crm/ui";
import { fmtDate, useCrm } from "@/lib/crm";
import { matchesClientSearch } from "@/lib/crm-rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "Reminders — Leads" },
      { name: "description", content: "Upcoming contact reminders and follow-ups." },
      { property: "og:title", content: "Reminders — Leads" },
      { property: "og:description", content: "Upcoming contact reminders and follow-ups." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reminders,
});

const TABS = ["All Reminders", "Overdue", "Today", "This Week", "This Month"] as const;

function Reminders() {
  const { clients } = useCrm();
  const [tab, setTab] = useState<(typeof TABS)[number]>("All Reminders");
  const [q, setQ] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const plus = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

  const all = clients
    .flatMap((c) => c.contacts.filter((k) => k.reminder).map((k) => ({ c, k })))
    .sort((a, b) => a.k.reminder.localeCompare(b.k.reminder));
  const match = (t: (typeof TABS)[number], r: string) =>
    t === "All Reminders"
      ? true
      : t === "Overdue"
        ? r < today
        : t === "Today"
          ? r === today
          : t === "This Week"
            ? r >= today && r <= plus(7)
            : r >= today && r <= plus(31);
  const rows = all.filter(
    ({ c, k }) => match(tab, k.reminder) && matchesClientSearch({ ...c, contacts: [k] }, q),
  );

  return (
    <AppShell>
      <PageHeader
        title="Reminders"
        subtitle="Upcoming contact reminders and follow-ups"
        actions={
          <SearchBox
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reminders..."
          />
        }
      />
      <Card className="p-0">
        <div className="flex flex-wrap gap-1 border-b border-border p-3">
          {TABS.map((t) => {
            const n = all.filter(({ k }) => match(t, k.reminder)).length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold",
                  tab === t ? "bg-primary/10 text-primary" : "hover:bg-accent",
                )}
              >
                {t}
                <span
                  className={cn(
                    "rounded-full px-2 text-xs",
                    t === "Overdue"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
              <tr>
                {["Date", "Company", "Contact Person", "Purpose", "Type", "Status", "Actions"].map(
                  (h) => (
                    <th key={h} className="px-4 py-3">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, k }) => {
                const overdue = k.reminder < today;
                return (
                  <tr key={k.id} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold text-destructive whitespace-nowrap">
                      {fmtDate(k.reminder)}
                    </td>
                    <td className="px-4 py-3">{c.company}</td>
                    <td className="px-4 py-3">{k.name}</td>
                    <td className="px-4 py-3">{k.notes || "Follow up"}</td>
                    <td className="px-4 py-3">
                      <TypeBadge type={c.type} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          overdue ? "bg-bad/15 text-bad" : "bg-potential/15 text-potential",
                        )}
                      >
                        {overdue ? "Overdue" : "Upcoming"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to="/clients/$id" params={{ id: c.id }}>
                        <IconBtn aria-label="View">
                          <Eye className="size-4" />
                        </IconBtn>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground">
                    No reminders here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
