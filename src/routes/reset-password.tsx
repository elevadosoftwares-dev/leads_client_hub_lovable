import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { changePassword, getSession } from "@/lib/auth.functions";
import leadsLogo from "@/assets/leads-logo.png";
import { Btn, Card, Field, Input } from "@/components/crm/ui";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set New Password — Leads" },
      { name: "description", content: "Choose a new password for your Leads account." },
      { property: "og:title", content: "Set New Password — Leads" },
      { property: "og:description", content: "Choose a new password for your Leads account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Changing the password needs a signed-in user.
    getSession()
      .then((user) => setReady(!!user))
      .catch(() => setReady(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await changePassword({ data: { password } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the password");
      return;
    } finally {
      setBusy(false);
    }
    toast.success("Password updated");
    nav({ to: "/" });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={leadsLogo} alt="Leads" className="h-16 w-auto" />
          <h1 className="text-xl font-bold">Choose a new password</h1>
        </div>
        {ready ? (
          <form onSubmit={submit} className="space-y-4">
            <Field label="New password" required>
              <Input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </Field>
            <Field label="Confirm password" required>
              <Input
                required
                type="password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat the password"
              />
            </Field>
            <Btn type="submit" className="w-full" disabled={busy}>
              {busy ? "Saving..." : "Save password"}
            </Btn>
          </form>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Sign in first to change your password. Forgot it? Ask your administrator to reset it.{" "}
            <Link to="/auth" search={{ redirect: "" }} className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        )}
      </Card>
    </div>
  );
}
