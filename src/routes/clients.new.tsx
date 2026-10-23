import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Btn, Card, ContactFields, Field, PageHeader, Select } from "@/components/crm/ui";
import { emptyContact, useCrm } from "@/lib/crm";

export const Route = createFileRoute("/clients/new")({
  head: () => ({
    meta: [
      { title: "Add Contact Person — Leads" },
      { name: "description", content: "Add a contact person to a client company." },
      { property: "og:title", content: "Add Contact Person — Leads" },
      { property: "og:description", content: "Add a contact person to a client company." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewContact,
});

function NewContact() {
  const { clients, upsertContact } = useCrm();
  const nav = useNavigate();
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState(emptyContact());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.company === company);
    if (!client) {
      toast.error("Select a client");
      return;
    }
    upsertContact(client.id, {
      ...contact,
      name: contact.name.trim(),
      email: contact.email.trim(),
      talent: (contact.talent ?? "").slice(0, 30),
    });
    toast.success("Contact person saved");
    nav({ to: "/clients/$id", params: { id: client.id } });
  };

  return (
    <AppShell>
      <form onSubmit={submit}>
        <PageHeader
          title="Add Contact Person"
          back={
            <Link to="/" aria-label="Back">
              <ArrowLeft className="size-5" />
            </Link>
          }
          actions={
            <>
              <Link to="/">
                <Btn type="button" variant="outline">
                  Cancel
                </Btn>
              </Link>
              <Btn type="submit">Save Contact</Btn>
            </>
          }
        />
        <Card className="mb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client" required>
              <Select
                required
                options={clients.map((c) => c.company)}
                placeholder="Select client"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Missing a client? Add it under{" "}
            <Link to="/master-lists" className="text-primary underline">
              Master Lists → Clients
            </Link>
            .
          </p>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Contact Person Information</h2>
          <ContactFields value={contact} onChange={setContact} />
        </Card>
      </form>
    </AppShell>
  );
}
