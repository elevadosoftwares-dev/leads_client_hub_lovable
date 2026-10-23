import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Btn, Field, IconBtn, Input, PageHeader } from "@/components/crm/ui";
import { uid, useCrm, type MasterKey } from "@/lib/crm";

export const Route = createFileRoute("/master-lists")({
  head: () => ({
    meta: [
      { title: "Master Lists — Leads" },
      {
        name: "description",
        content: "Manage clients, contact types, departments, nationalities and religions.",
      },
      { property: "og:title", content: "Master Lists — Leads" },
      {
        property: "og:description",
        content: "Manage clients, contact types, departments, nationalities and religions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MasterListsPage,
});

type Cat = MasterKey | "clients";
const categories: { key: Cat; label: string }[] = [
  { key: "clients", label: "Clients" },
  { key: "types", label: "Type of contact" },
  { key: "departments", label: "Department" },
  { key: "nationalities", label: "Nationality" },
  { key: "religions", label: "Religion" },
];

function MasterListsPage() {
  const crm = useCrm();
  const { clients } = crm;
  const today = new Date().toISOString().slice(0, 10);
  const masterLists = { ...crm.masterLists, clients: clients.map((c) => c.company) } as Record<
    Cat,
    string[]
  >;
  const addMasterOption = (key: Cat, v: string) =>
    key === "clients"
      ? crm.addClient({
          id: uid(),
          company: v,
          industry: "",
          location: "",
          website: "",
          type: crm.masterLists.types[0] ?? "",
          departments: [],
          blocked: false,
          lastContact: today,
          notes: "",
          contacts: [],
        })
      : crm.addMasterOption(key, v);
  const renameMasterOption = (key: Cat, old: string, v: string) => {
    if (key !== "clients") return crm.renameMasterOption(key, old, v);
    const c = clients.find((x) => x.company === old);
    if (c) crm.updateClient(c.id, { company: v });
  };
  const removeMasterOption = (key: Cat, v: string) => {
    if (key !== "clients") return crm.removeMasterOption(key, v);
    const c = clients.find((x) => x.company === v);
    if (c) crm.removeClient(c.id);
  };
  const [category, setCategory] = useState<Cat>("clients");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const label = categories.find((entry) => entry.key === category)?.label ?? "";
  const inUse = (value: string) =>
    category === "clients"
      ? (clients.find((c) => c.company === value)?.contacts.length ?? 0) > 0
      : clients.some((client) =>
          category === "types"
            ? client.type === value
            : category === "departments"
              ? client.departments.includes(value)
              : client.contacts.some((contact) =>
                  category === "nationalities"
                    ? contact.nationality === value
                    : contact.religion === value,
                ),
        );
  const valid = (value: string, oldValue?: string) => {
    if (!value.trim()) {
      toast.error("Enter a value");
      return false;
    }
    if (
      masterLists[category].some(
        (entry) => entry !== oldValue && entry.toLowerCase() === value.trim().toLowerCase(),
      )
    ) {
      toast.error("This value already exists");
      return false;
    }
    return true;
  };
  const q = draft.trim().toLowerCase();
  const suggestions =
    q && !editing ? masterLists[category].filter((value) => value.toLowerCase().includes(q)) : [];
  return (
    <AppShell>
      <PageHeader title="Master Lists" />
      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((entry) => (
          <Btn
            key={entry.key}
            variant={category === entry.key ? "primary" : "outline"}
            onClick={() => {
              setCategory(entry.key);
              setDraft("");
              setEditing(null);
            }}
          >
            {entry.label}
          </Btn>
        ))}
      </div>
      <section className="max-w-3xl">
        <h2 className="mb-4 text-lg font-semibold">{label}</h2>
        <form
          className="mb-6 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid(draft)) {
              addMasterOption(category, draft.trim());
              setDraft("");
              toast.success("Value added");
            }
          }}
        >
          <div className="relative min-w-48 flex-1">
            <Field label={`New ${label.toLowerCase()}`}>
              <Input
                maxLength={100}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </Field>
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-md">
                {suggestions.map((value) => (
                  <li key={value}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setEditing(value);
                        setEditValue(value);
                        setDraft("");
                      }}
                    >
                      <span className="min-w-0 truncate">{value}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {category === "clients" ? "Existing client" : "Existing value"}
                        {inUse(value) ? " · in use" : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Btn type="submit">
            <Plus className="size-4" />
            Add
          </Btn>
        </form>
        <ul className="divide-y divide-border border-y border-border">
          {masterLists[category].map((value) => (
            <li key={value} className="flex min-h-16 items-center justify-between gap-3 py-3">
              {editing === value ? (
                <form
                  className="flex w-full items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (valid(editValue, value)) {
                      renameMasterOption(category, value, editValue.trim());
                      setEditing(null);
                      toast.success("Value updated");
                    }
                  }}
                >
                  <Input
                    aria-label="Edit value"
                    maxLength={100}
                    value={editValue}
                    onChange={(event) => setEditValue(event.target.value)}
                  />
                  <IconBtn type="submit" aria-label="Save value">
                    <Check className="size-4" />
                  </IconBtn>
                  <IconBtn
                    type="button"
                    aria-label="Cancel editing"
                    onClick={() => setEditing(null)}
                  >
                    <X className="size-4" />
                  </IconBtn>
                </form>
              ) : (
                <>
                  <span className="min-w-0 break-words font-medium">{value}</span>
                  <div className="flex shrink-0 gap-2">
                    <IconBtn
                      aria-label={`Edit ${value}`}
                      onClick={() => {
                        setEditing(value);
                        setEditValue(value);
                      }}
                    >
                      <Pencil className="size-4" />
                    </IconBtn>
                    <IconBtn
                      tone="danger"
                      aria-label={`Delete ${value}`}
                      onClick={() => {
                        if (inUse(value)) {
                          toast.error(
                            category === "clients"
                              ? "This client has contact persons. Remove them first."
                              : "This value is used by a client. Edit it instead.",
                          );
                          return;
                        }
                        removeMasterOption(category, value);
                        toast.success("Value removed");
                      }}
                    >
                      <Trash2 className="size-4" />
                    </IconBtn>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        {!masterLists[category].length && (
          <p className="py-6 text-muted-foreground">No values yet.</p>
        )}
      </section>
    </AppShell>
  );
}
