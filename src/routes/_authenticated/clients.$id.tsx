import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Ban, Globe, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  AppShell,
  Btn,
  Card,
  ContactFields,
  Field,
  IconBtn,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
  Input,
  TypeBadge,
} from "@/components/crm/ui";
import {
  emptyContact,
  fmtDate,
  initials,
  useCrm,
  RELATIONSHIPS,
  type ClientType,
  type Contact,
} from "@/lib/crm";
import { SPECIAL_NOTE_LIMIT } from "@/lib/crm-rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({
    meta: [
      { title: "Client Details — Leads" },
      { name: "description", content: "Company profile, employees, notes and reminders." },
      { property: "og:title", content: "Client Details — Leads" },
      { property: "og:description", content: "Company profile, employees, notes and reminders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientDetails,
});

const avatarTones = [
  "bg-lead/20 text-lead",
  "bg-primary/15 text-primary",
  "bg-contacted/15 text-contacted",
  "bg-existing/15 text-existing",
];

function ClientDetails() {
  const { id } = Route.useParams();
  const { clients, masterLists, updateClient, upsertContact, removeContact, isAdmin, loading } =
    useCrm();
  const client = clients.find((c) => c.id === id);
  const [tab, setTab] = useState<"Contacts" | "Notes" | "Reminders">("Contacts");
  const [editing, setEditing] = useState<Contact | null>(null);

  if (!client)
    return (
      <AppShell>
        <p className="text-muted-foreground">
          {loading ? (
            "Loading client..."
          ) : (
            <>
              Client not found.{" "}
              <Link to="/" className="text-primary">
                Back to clients
              </Link>
            </>
          )}
        </p>
      </AppShell>
    );

  const toggleBlock = async () => {
    const ok = await updateClient(
      client.id,
      client.blocked
        ? { blocked: false, blockReason: undefined, blockedOn: undefined }
        : {
            blocked: true,
            blockReason: "Blocked from client page",
            blockedOn: new Date().toISOString().slice(0, 10),
          },
    );
    if (ok) toast(client.blocked ? "Client unblocked" : "Client added to blocklist");
  };

  return (
    <AppShell>
      <PageHeader
        title="Client Details"
        back={
          <Link to="/" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
        }
        actions={
          isAdmin ? (
            <Btn variant="dangerOutline" onClick={toggleBlock}>
              <Ban className="size-4" /> {client.blocked ? "Unblock Client" : "Block Client"}
            </Btn>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="flex gap-5">
          <div className="grid size-24 shrink-0 place-items-center rounded-2xl bg-primary/10 font-display text-3xl font-bold text-primary">
            {initials(client.company)}
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{client.company}</h2>
              <StatusBadge blocked={client.blocked} />
            </div>
            {client.industry && <p className="text-muted-foreground">{client.industry}</p>}
            {client.website && (
              <p className="flex items-center gap-2 text-sm text-primary">
                <Globe className="size-4" />
                {client.website}
              </p>
            )}
            {client.location && (
              <p className="flex items-center gap-2 text-sm">
                <MapPin className="size-4" />
                {client.location}
              </p>
            )}
          </div>
        </Card>
        <Card className="space-y-4">
          <Field label="Type of contact">
            <Select
              className="max-w-60"
              disabled={!isAdmin}
              options={masterLists.types}
              value={client.type}
              onChange={(e) => updateClient(client.id, { type: e.target.value as ClientType })}
            />
          </Field>
          <div className="mt-1">
            <TypeBadge type={client.type} />
          </div>
          <Field label="Department">
            <Select
              disabled={!isAdmin}
              options={masterLists.departments}
              placeholder="Select department"
              value={client.departments[0] ?? ""}
              onChange={(e) =>
                updateClient(client.id, { departments: e.target.value ? [e.target.value] : [] })
              }
            />
          </Field>
          <Field label="Relationship with Leads">
            <Select
              className="max-w-60"
              disabled={!isAdmin}
              options={RELATIONSHIPS}
              placeholder="Select relationship"
              value={client.relationship ?? ""}
              onChange={(e) =>
                updateClient(client.id, {
                  relationship: e.target.value as (typeof RELATIONSHIPS)[number],
                })
              }
            />
          </Field>
        </Card>
      </div>

      <div className="mb-4 flex gap-2">
        {(["Contacts", "Notes", "Reminders"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-5 py-2 text-sm font-semibold",
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-surface border border-border hover:bg-accent",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Contacts" && (
        <Card className="p-0">
          <div className="flex items-center justify-between p-5">
            <h3 className="text-lg font-semibold">List of Company Employees</h3>
            {isAdmin && (
              <Btn onClick={() => setEditing(emptyContact())}>
                <Plus className="size-4" /> Add Contact
              </Btn>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  {[
                    "Name",
                    "Designation",
                    "Nationality",
                    "DOB",
                    "Race",
                    "Gender",
                    "Religion",
                    "Contact",
                    "Reminder",
                    "Relationship with Leads",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {client.contacts.map((k, i) => (
                  <tr key={k.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "grid size-8 place-items-center rounded-full text-xs font-bold",
                            avatarTones[i % 4],
                          )}
                        >
                          {initials(k.name)}
                        </span>
                        <span className="font-medium whitespace-nowrap">{k.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{k.designation}</td>
                    <td className="px-4 py-3">{k.nationality}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(k.dob)}</td>
                    <td className="px-4 py-3">{k.race}</td>
                    <td className="px-4 py-3">{k.gender}</td>
                    <td className="px-4 py-3">{k.religion}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>{k.phone}</div>
                      <div className="text-primary">{k.email}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-destructive">
                      {k.reminder ? fmtDate(k.reminder) : "—"}
                    </td>
                    <td className="px-4 py-3">{k.relationship || "—"}</td>
                    <td className="px-4 py-3">
                      {isAdmin && (
                        <div className="flex gap-2">
                          <IconBtn aria-label="Edit" onClick={() => setEditing(k)}>
                            <Pencil className="size-4" />
                          </IconBtn>
                          <IconBtn
                            aria-label="Delete"
                            tone="danger"
                            onClick={async () => {
                              if (await removeContact(client.id, k.id))
                                toast.success("Contact removed");
                            }}
                          >
                            <Trash2 className="size-4" />
                          </IconBtn>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "Notes" && (
        <Card>
          <Field label="Special Note about the client">
            <Textarea
              className="min-h-40"
              maxLength={SPECIAL_NOTE_LIMIT}
              readOnly={!isAdmin}
              value={client.notes}
              onChange={(e) => updateClient(client.id, { notes: e.target.value })}
              placeholder="Write a special note..."
            />
          </Field>
          {client.contacts
            .filter((k) => k.notes)
            .map((k) => (
              <div key={k.id} className="mt-4 rounded-lg bg-muted p-3 text-sm">
                <span className="font-semibold">{k.name}:</span> {k.notes}
              </div>
            ))}
        </Card>
      )}

      {tab === "Reminders" && (
        <Card className="space-y-3">
          {client.contacts
            .filter((k) => k.reminder)
            .map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
              >
                <span>
                  <span className="font-semibold">{k.name}</span> — {k.notes || "Follow up"}
                </span>
                <span className="font-semibold text-destructive">{fmtDate(k.reminder)}</span>
              </div>
            ))}
          {!client.contacts.some((k) => k.reminder) && (
            <p className="text-muted-foreground">No reminders set.</p>
          )}
        </Card>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
          <form
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await upsertContact(client.id, editing)) {
                setEditing(null);
                toast.success("Contact saved");
              }
            }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {client.contacts.some((k) => k.id === editing.id)
                  ? `Edit Contact — ${editing.name}`
                  : "Add Contact"}
              </h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <ContactFields value={editing} onChange={setEditing} />
            <div className="mt-6 flex justify-end gap-2">
              <Btn type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Btn>
              <Btn type="submit">Update</Btn>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
