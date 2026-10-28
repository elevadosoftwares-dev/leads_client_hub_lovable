import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Ban,
  KeyRound,
  LayoutGrid,
  LogOut,
  Search,
  ListChecks,
  UsersRound,
} from "lucide-react";
import leadsLogo from "@/assets/leads-logo-light.png";
import type {
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import { signOut as signOutFn } from "@/lib/auth.functions";
import type { ClientType, Contact } from "@/lib/crm";
import { GENDERS, RACES, RELATIONSHIPS, useCrm } from "@/lib/crm";

const typeStyles: Record<ClientType, string> = {
  Lead: "bg-lead/15 text-lead",
  Contacted: "bg-contacted/15 text-contacted",
  "Existing Client": "bg-existing/15 text-existing",
  "Potential Contact": "bg-potential/15 text-potential",
  "Bad Lead": "bg-bad/15 text-bad",
};
export const typeTone: Record<ClientType, string> = {
  Lead: "bg-lead",
  Contacted: "bg-contacted",
  "Existing Client": "bg-existing",
  "Potential Contact": "bg-potential",
  "Bad Lead": "bg-bad",
};

export function TypeBadge({ type }: { type: ClientType }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        typeStyles[type] ?? "bg-muted text-foreground",
      )}
    >
      {type}
    </span>
  );
}

export function StatusBadge({ blocked }: { blocked: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        blocked ? "bg-bad/15 text-bad" : "bg-existing/15 text-existing",
      )}
    >
      {blocked ? "Blocked" : "Active"}
    </span>
  );
}

const nav = [
  { to: "/", label: "Clients", icon: LayoutGrid },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/blocklist", label: "Blocklist", icon: Ban },
  { to: "/master-lists", label: "Master Lists", icon: ListChecks },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, role, userEmail } = useCrm();
  const navTo = useNavigate();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOutFn();
    navTo({ to: "/auth", replace: true, search: { redirect: "" } });
  };

  const items = isAdmin
    ? [...nav, { to: "/users", label: "Users", icon: UsersRound } as const]
    : nav;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-6 py-7">
          <Link to="/" className="block">
            <img src={leadsLogo} alt="Leads" className="h-auto w-full" />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((n) => {
            const active =
              n.to === "/" ? path === "/" || path.startsWith("/clients") : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                    : "hover:bg-sidebar-accent",
                )}
              >
                <n.icon className="size-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-sidebar-accent p-4">
          <div className="mb-1 truncate text-sm font-medium">{userEmail ?? ""}</div>
          <div className="mb-3">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                isAdmin
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "bg-sidebar-accent text-sidebar-foreground",
              )}
            >
              {role === "admin" ? "Admin — can edit" : "User — view only"}
            </span>
          </div>
          <Link
            to="/reset-password"
            className="mb-2 flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground"
          >
            <KeyRound className="size-4" /> Change password
          </Link>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <nav className="mb-5 flex flex-wrap items-center gap-3 md:hidden">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-1 text-sm text-primary"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
          <button
            onClick={signOut}
            className="ml-auto flex items-center gap-1 text-sm text-muted-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </nav>
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: string;
  back?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {back}
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function SearchBox(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative min-w-60 flex-1">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        {...props}
        className="h-10 w-full rounded-lg border border-input bg-surface pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function Btn({
  variant = "primary",
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "danger" | "dangerOutline" | "ghost";
}) {
  const v = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
    outline: "border border-input bg-surface hover:bg-accent",
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    dangerOutline:
      "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
    ghost: "hover:bg-accent",
  }[variant];
  return (
    <button
      {...p}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-50",
        v,
        className,
      )}
    />
  );
}

export function IconBtn({
  tone = "primary",
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "danger" }) {
  return (
    <button
      {...p}
      className={cn(
        "grid size-8 place-items-center rounded-md border transition-colors",
        tone === "primary"
          ? "border-primary/30 text-primary hover:bg-primary/10"
          : "border-destructive/30 text-destructive hover:bg-destructive/10",
      )}
    />
  );
}

const fieldCls =
  "h-10 w-full rounded-lg border border-input bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";

export function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm", className)}>
      <span className="font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={cn(fieldCls, p.className)} />
);
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cn(fieldCls, "h-auto min-h-24 py-2", p.className)} />
);
export function Select({
  options,
  placeholder,
  ...p
}: SelectHTMLAttributes<HTMLSelectElement> & { options: readonly string[]; placeholder?: string }) {
  return (
    <select {...p} className={cn(fieldCls, p.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

export function ContactFields({
  value,
  onChange,
}: {
  value: Contact;
  onChange: (c: Contact) => void;
}) {
  const { masterLists } = useCrm();
  const set = (k: keyof Contact) => (e: { target: { value: string } }) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Full Name" required>
        <Input
          required
          maxLength={100}
          value={value.name}
          onChange={set("name")}
          placeholder="Enter full name"
        />
      </Field>
      <Field label="Designation" required>
        <Input
          required
          maxLength={100}
          value={value.designation}
          onChange={set("designation")}
          placeholder="Enter designation"
        />
      </Field>
      <Field label="Nationality" required>
        <Select
          required
          options={masterLists.nationalities}
          placeholder="Select nationality"
          value={value.nationality}
          onChange={set("nationality")}
        />
      </Field>
      <Field label="Date of Birth">
        <Input type="date" value={value.dob} onChange={set("dob")} />
      </Field>
      <Field label="Race" required>
        <Select
          required
          options={RACES}
          placeholder="Select race"
          value={value.race}
          onChange={set("race")}
        />
      </Field>
      <Field label="Gender" required>
        <Select
          required
          options={GENDERS}
          placeholder="Select gender"
          value={value.gender}
          onChange={set("gender")}
        />
      </Field>
      <Field label="Religion" required>
        <Select
          required
          options={masterLists.religions}
          placeholder="Select religion"
          value={value.religion}
          onChange={set("religion")}
        />
      </Field>
      <Field label="Contact Number" required>
        <Input
          required
          type="tel"
          maxLength={25}
          pattern="[+0-9 \(\)\-]{6,25}"
          value={value.phone}
          onChange={set("phone")}
          placeholder="+60 12-345 6789"
        />
      </Field>
      <Field label="Email" required className="lg:col-span-2">
        <Input
          required
          type="email"
          maxLength={255}
          value={value.email}
          onChange={set("email")}
          placeholder="Enter email address"
        />
      </Field>
      <Field label="Distinctive talent of the client">
        <Input maxLength={30} value={value.talent ?? ""} onChange={set("talent")} />
        <span className="text-xs text-muted-foreground">{(value.talent ?? "").length}/30</span>
      </Field>
      <Field label="Reminder to Contact">
        <Input type="date" value={value.reminder} onChange={set("reminder")} />
      </Field>
      <Field label="Relationship with Leads">
        <Select
          options={RELATIONSHIPS}
          placeholder="Select relationship"
          value={value.relationship ?? ""}
          onChange={set("relationship")}
        />
      </Field>
      <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
        <Textarea
          maxLength={1000}
          value={value.notes}
          onChange={set("notes")}
          placeholder="Enter notes about this contact..."
        />
      </Field>
    </div>
  );
}
