import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Building2,
  Eye,
  Handshake,
  Pencil,
  Phone,
  Plus,
  Target,
  Users,
  XCircle,
} from "lucide-react";
import {
  AppShell,
  Btn,
  Card,
  IconBtn,
  PageHeader,
  SearchBox,
  Select,
  StatusBadge,
  TypeBadge,
} from "@/components/crm/ui";
import { fmtDate, initials, useCrm } from "@/lib/crm";
import { matchesClientSearch } from "@/lib/crm-rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clients — Leads" },
      { name: "description", content: "Manage client companies, contacts, types and follow-ups." },
      { property: "og:title", content: "Clients — Leads" },
      {
        property: "og:description",
        content: "Manage client companies, contacts, types and follow-ups.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientsPage,
});

const PAGE = 5;

function ClientsPage() {
  const { clients, masterLists } = useCrm();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [nat, setNat] = useState("");
  const [svc, setSvc] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const count = (t: string) => clients.filter((c) => c.type === t).length;
  const stats = [
    {
      label: "Total Companies",
      value: clients.length,
      icon: Building2,
      tone: "bg-total",
      tint: "bg-total/10",
    },
    { label: "Leads", value: count("Lead"), icon: Target, tone: "bg-lead", tint: "bg-lead/10" },
    {
      label: "Contacted",
      value: count("Contacted"),
      icon: Phone,
      tone: "bg-contacted",
      tint: "bg-contacted/10",
    },
    {
      label: "Existing Clients",
      value: count("Existing Client"),
      icon: Handshake,
      tone: "bg-existing",
      tint: "bg-existing/10",
    },
    {
      label: "Potential Contacts",
      value: count("Potential Contact"),
      icon: Users,
      tone: "bg-potential",
      tint: "bg-potential/10",
    },
    {
      label: "Bad Leads",
      value: count("Bad Lead"),
      icon: XCircle,
      tone: "bg-bad",
      tint: "bg-bad/10",
    },
  ];

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return clients.filter((c) => {
      if (
        !matchesClientSearch(
          { ...c, status: c.blocked ? "Blocked" : "Active", relationship: c.relationship ?? "" },
          s,
        )
      )
        return false;
      if (type && c.type !== type) return false;
      if (nat && !c.contacts.some((k) => k.nationality === nat)) return false;
      if (svc && !c.departments.includes(svc)) return false;
      if (status && (status === "Blocked") !== c.blocked) return false;
      return true;
    });
  }, [clients, q, type, nat, svc, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const reset = () => {
    setQ("");
    setType("");
    setNat("");
    setSvc("");
    setStatus("");
    setPage(1);
  };

  return (
    <AppShell>
      <PageHeader
        title="Clients"
        subtitle="Manage your client relationships, contacts and opportunities"
        actions={
          <Link to="/clients/new">
            <Btn>
              <Plus className="size-4" /> Add Contact Person
            </Btn>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className={cn("flex items-center gap-3 rounded-2xl p-4", s.tint)}>
            <div
              className={cn(
                "grid size-12 place-items-center rounded-xl text-primary-foreground shadow-md",
                s.tone,
              )}
            >
              <s.icon className="size-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
              <div className="font-display text-2xl font-bold">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <SearchBox
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search all client and contact fields..."
          />
          <Select
            className="w-40"
            options={masterLists.types}
            placeholder="All Types"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          />
          <Select
            className="w-44"
            options={masterLists.nationalities}
            placeholder="All Nationalities"
            value={nat}
            onChange={(e) => {
              setNat(e.target.value);
              setPage(1);
            }}
          />
          <Select
            className="w-40"
            options={masterLists.departments}
            placeholder="All Departments"
            value={svc}
            onChange={(e) => {
              setSvc(e.target.value);
              setPage(1);
            }}
          />
          <Select
            className="w-36"
            options={["Active", "Blocked"]}
            placeholder="All Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          />
          <Btn variant="outline" onClick={reset}>
            Reset
          </Btn>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
              <tr>
                {[
                  "Company Name",
                  "Primary Contact",
                  "Designation",
                  "Nationality",
                  "Contact",
                  "Type",
                  "Last Contact",
                  "Next Reminder",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const p = c.contacts[0];
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                          {initials(c.company)}
                        </div>
                        <span className="font-semibold">{c.company}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{p?.name ?? "—"}</td>
                    <td className="px-4 py-3">{p?.designation ?? "—"}</td>
                    <td className="px-4 py-3">{p?.nationality ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p && (
                        <>
                          <div>{p.phone}</div>
                          <div className="text-primary">{p.email}</div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={c.type} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(c.lastContact)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-destructive">
                      {p?.reminder ? fmtDate(p.reminder) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge blocked={c.blocked} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link to="/clients/$id" params={{ id: c.id }}>
                          <IconBtn aria-label="View">
                            <Eye className="size-4" />
                          </IconBtn>
                        </Link>
                        <Link to="/clients/$id" params={{ id: c.id }}>
                          <IconBtn aria-label="Edit">
                            <Pencil className="size-4" />
                          </IconBtn>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-muted-foreground">
                    No clients match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border p-4 text-sm text-muted-foreground">
          <span>
            Showing {filtered.length ? (page - 1) * PAGE + 1 : 0} to{" "}
            {Math.min(page * PAGE, filtered.length)} of {filtered.length} companies
          </span>
          <div className="flex gap-1">
            {Array.from({ length: pages }, (_, i) => i + 1).map((i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={cn(
                  "size-8 rounded-md",
                  i === page ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
