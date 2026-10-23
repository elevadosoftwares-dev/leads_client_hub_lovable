import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  AppShell,
  Btn,
  Card,
  Field,
  IconBtn,
  Input,
  PageHeader,
  SearchBox,
  Select,
} from "@/components/crm/ui";
import { matchesClientSearch } from "@/lib/crm-rules";
import { fmtDate, useCrm } from "@/lib/crm";

export const Route = createFileRoute("/blocklist")({
  head: () => ({
    meta: [
      { title: "Blocklist — Leads" },
      { name: "description", content: "Companies and contacts that are blocked." },
      { property: "og:title", content: "Blocklist — Leads" },
      { property: "og:description", content: "Companies and contacts that are blocked." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Blocklist,
});

function Blocklist() {
  const { clients, updateClient } = useCrm();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");
  const [reason, setReason] = useState("");
  const blocked = clients.filter((c) => c.blocked && matchesClientSearch(c, q));
  const active = clients.filter((c) => !c.blocked);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const c = active.find((x) => x.company === pick);
    if (!c) return;
    updateClient(c.id, {
      blocked: true,
      blockReason: reason.trim().slice(0, 200) || "No reason given",
      blockedOn: new Date().toISOString().slice(0, 10),
    });
    toast.success(`${c.company} blocked`);
    setAdding(false);
    setPick("");
    setReason("");
  };

  return (
    <AppShell>
      <PageHeader
        title="Blocklist"
        subtitle="Companies or contacts that are blocked"
        actions={
          <>
            <SearchBox
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search blocked companies..."
            />
            <Btn variant="danger" onClick={() => setAdding(!adding)}>
              <Plus className="size-4" /> Add to Blocklist
            </Btn>
          </>
        }
      />
      {adding && (
        <Card className="mb-6">
          <form onSubmit={add} className="grid items-end gap-4 md:grid-cols-[1fr_2fr_auto]">
            <Field label="Company" required>
              <Select
                required
                options={active.map((c) => c.company)}
                placeholder="Select company"
                value={pick}
                onChange={(e) => setPick(e.target.value)}
              />
            </Field>
            <Field label="Reason">
              <Input
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this client blocked?"
              />
            </Field>
            <Btn variant="danger" type="submit">
              Block
            </Btn>
          </form>
        </Card>
      )}
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
              <tr>
                {[
                  "Company Name",
                  "Contact Person",
                  "Designation",
                  "Reason",
                  "Date Added",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blocked.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold">{c.company}</td>
                  <td className="px-4 py-3">{c.contacts[0]?.name ?? "—"}</td>
                  <td className="px-4 py-3">{c.contacts[0]?.designation ?? "—"}</td>
                  <td className="px-4 py-3 text-destructive">{c.blockReason}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtDate(c.blockedOn)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link to="/clients/$id" params={{ id: c.id }}>
                        <IconBtn aria-label="View">
                          <Eye className="size-4" />
                        </IconBtn>
                      </Link>
                      <IconBtn
                        aria-label="Unblock"
                        tone="danger"
                        onClick={() => {
                          updateClient(c.id, { blocked: false });
                          toast("Unblocked");
                        }}
                      >
                        <Undo2 className="size-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
              {!blocked.length && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted-foreground">
                    No blocked clients.
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
