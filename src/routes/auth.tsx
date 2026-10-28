import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn } from "lucide-react";
import { toast } from "sonner";

import { bootstrapFirstAdmin, isSetupRequired, signIn as signInFn } from "@/lib/auth.functions";
import leadsLogo from "@/assets/leads-logo.png";
import { Btn, Card, Field, Input } from "@/components/crm/ui";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Sign In — Leads" },
      { name: "description", content: "Sign in to the Leads client relationship manager." },
      { property: "og:title", content: "Sign In — Leads" },
      { property: "og:description", content: "Sign in to the Leads client relationship manager." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const qc = useQueryClient();
  const { data: setup } = useQuery({
    queryKey: ["setup-required"],
    queryFn: () => isSetupRequired(),
  });
  const firstRun = setup?.setupRequired === true;

  const safeRedirect = redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (firstRun) {
        await bootstrapFirstAdmin({ data: { email: email.trim(), password } });
        toast.success("Administrator account created");
      }
      await signInFn({ data: { email: email.trim(), password } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
      return;
    } finally {
      setBusy(false);
    }
    qc.clear();
    nav({ to: safeRedirect });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={leadsLogo} alt="Leads" className="h-16 w-auto" />
          <div>
            <h1 className="text-xl font-bold">
              {forgot
                ? "Reset your password"
                : firstRun
                  ? "Create the administrator"
                  : "Sign in to Leads"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {forgot
                ? "Ask your administrator to set a new password for you from the Users page."
                : firstRun
                  ? "No accounts exist yet. This first account will be the administrator."
                  : "Client relationship manager — sign in to continue."}
            </p>
          </div>
        </div>

        {forgot ? (
          <button
            type="button"
            className="w-full text-center text-sm text-primary hover:underline"
            onClick={() => setForgot(false)}
          >
            Back to sign in
          </button>
        ) : (
          <form onSubmit={signIn} className="space-y-4">
            <Field label="Email" required>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </Field>
            <Field label="Password" required>
              <Input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
            </Field>
            <Btn type="submit" className="w-full" disabled={busy}>
              <LogIn className="size-4" />{" "}
              {busy ? "Signing in..." : firstRun ? "Create Administrator" : "Sign In"}
            </Btn>
            <button
              type="button"
              className="w-full text-center text-sm text-primary hover:underline"
              onClick={() => setForgot(true)}
            >
              Forgot your password?
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Accounts are created by your administrator. Ask them for an invite.
        </p>
      </Card>
    </div>
  );
}
