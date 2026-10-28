import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  AppShell,
  Btn,
  Card,
  Field,
  IconBtn,
  Input,
  PageHeader,
  Select,
} from "@/components/crm/ui";
import { useCrm } from "@/lib/crm";
import {
  createUserAccount,
  deleteUserAccount,
  listUsers,
  resetUserPassword,
  setUserRole,
} from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users — Leads" },
      { name: "description", content: "Manage who can sign in and who can edit." },
      { property: "og:title", content: "Users — Leads" },
      { property: "og:description", content: "Manage who can sign in and who can edit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { isAdmin } = useCrm();
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const createUser = useServerFn(createUserAccount);
  const changeRole = useServerFn(setUserRole);
  const removeUser = useServerFn(deleteUserAccount);
  const resetPassword = useServerFn(resetUserPassword);

  const usersQ = useQuery({
    queryKey: ["app-users"],
    queryFn: () => fetchUsers(),
    enabled: isAdmin,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    return (
      <AppShell>
        <PageHeader title="Users" />
        <Card>
          <p className="text-muted-foreground">Only admins can manage users.</p>
        </Card>
      </AppShell>
    );
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["app-users"] });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createUser({ data: { email: email.trim(), password } });
      toast.success(`Account created for ${email.trim()}`);
      setEmail("");
      setPassword("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  };

  const setRole = async (userId: string, role: "admin" | "user") => {
    try {
      await changeRole({ data: { userId, role } });
      toast.success("Role updated");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the role");
    }
  };

  const reset = async (userId: string, userEmail: string) => {
    const password = prompt(`New password for ${userEmail} (at least 8 characters)`);
    if (!password) return;
    try {
      await resetPassword({ data: { userId, password } });
      toast.success(`Password updated for ${userEmail}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the password");
    }
  };

  const remove = async (userId: string, userEmail: string) => {
    try {
      await removeUser({ data: { userId } });
      toast.success(`Removed ${userEmail}`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the account");
    }
  };

  return (
    <AppShell>
      <PageHeader title="Users" subtitle="Admins can add and edit data. Users can only view it." />

      <Card className="mb-6">
        <h2 className="mb-4 text-lg font-semibold">Add a user</h2>
        <form onSubmit={add} className="grid items-end gap-4 md:grid-cols-[2fr_2fr_auto]">
          <Field label="Email" required>
            <Input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
            />
          </Field>
          <Field label="Temporary password" required>
            <Input
              required
              type="text"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </Field>
          <Btn type="submit" disabled={busy}>
            <UserPlus className="size-4" /> {busy ? "Adding..." : "Add User"}
          </Btn>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          New accounts are view-only by default. Share the temporary password with the person; they
          can change it after signing in via “Forgot your password?”.
        </p>
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
              <tr>
                {["Email", "Role", "Added", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(usersQ.data ?? []).map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      className="w-36"
                      options={["user", "admin"]}
                      value={u.role}
                      onChange={(e) => setRole(u.id, e.target.value as "admin" | "user")}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <IconBtn
                      aria-label={`Reset password for ${u.email}`}
                      onClick={() => reset(u.id, u.email)}
                    >
                      <KeyRound className="size-4" />
                    </IconBtn>
                    <IconBtn
                      tone="danger"
                      aria-label={`Remove ${u.email}`}
                      onClick={() => remove(u.id, u.email)}
                    >
                      <Trash2 className="size-4" />
                    </IconBtn>
                  </td>
                </tr>
              ))}
              {usersQ.isLoading && (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-muted-foreground">
                    Loading users...
                  </td>
                </tr>
              )}
              {!usersQ.isLoading && !usersQ.data?.length && (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-muted-foreground">
                    No users yet.
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
