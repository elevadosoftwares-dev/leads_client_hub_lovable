import type React from "react";
import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getSession } from "@/lib/auth.functions";
import * as api from "@/lib/crm.functions";
import { limitClientFields } from "@/lib/crm-rules";

export const CLIENT_TYPES = [
  "Lead",
  "Contacted",
  "Existing Client",
  "Potential Contact",
  "Bad Lead",
] as const;
export type ClientType = string;
export const RELATIONSHIPS = ["Best", "Good", "Not Good"] as const;
export type MasterKey = "types" | "departments" | "nationalities" | "religions";
export type MasterLists = Record<MasterKey, string[]>;
export const RACES = ["Malay", "Chinese", "Indian", "Caucasian", "Eurasian", "Other"];
export const GENDERS = ["Male", "Female", "Other"];

export type Contact = {
  id: string;
  name: string;
  designation: string;
  nationality: string;
  dob: string;
  race: string;
  gender: string;
  religion: string;
  phone: string;
  email: string;
  reminder: string;
  notes: string;
  talent?: string;
  relationship?: string;
};

export type Client = {
  id: string;
  company: string;
  industry: string;
  location: string;
  website: string;
  type: ClientType;
  departments: string[];
  talent?: string;
  relationship?: string;
  blocked: boolean;
  blockReason?: string | undefined;
  blockedOn?: string | undefined;
  lastContact: string;
  notes: string;
  contacts: Contact[];
};

export const uid = () => crypto.randomUUID();

type Ctx = {
  clients: Client[];
  masterLists: MasterLists;
  loading: boolean;
  role: "admin" | "user" | null;
  isAdmin: boolean;
  userEmail: string | null;
  addMasterOption: (key: MasterKey, value: string) => Promise<boolean>;
  renameMasterOption: (key: MasterKey, oldValue: string, value: string) => Promise<boolean>;
  removeMasterOption: (key: MasterKey, value: string) => Promise<boolean>;
  addClient: (c: Client) => Promise<boolean>;
  updateClient: (id: string, patch: Partial<Client>) => Promise<boolean>;
  upsertContact: (clientId: string, contact: Contact) => Promise<boolean>;
  removeContact: (clientId: string, contactId: string) => Promise<boolean>;
  removeClient: (id: string) => Promise<boolean>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const toContact = (r: any): Contact => ({
  id: r.id,
  name: r.name,
  designation: r.designation,
  nationality: r.nationality,
  dob: r.dob ?? "",
  race: r.race,
  gender: r.gender,
  religion: r.religion,
  phone: r.phone,
  email: r.email,
  reminder: r.reminder ?? "",
  notes: r.notes,
  talent: r.talent,
  relationship: r.relationship,
});

const toClient = (r: any, contacts: Contact[]): Client => ({
  id: r.id,
  company: r.company,
  industry: r.industry,
  location: r.location,
  website: r.website,
  type: r.type,
  departments: r.departments ?? [],
  talent: r.talent,
  relationship: r.relationship,
  blocked: r.blocked,
  blockReason: r.block_reason ?? undefined,
  blockedOn: r.blocked_on ?? undefined,
  lastContact: r.last_contact ?? "",
  notes: r.notes,
  contacts,
});

const clientRow = (c: Client) => ({
  company: c.company,
  industry: c.industry,
  location: c.location,
  website: c.website,
  type: c.type,
  departments: c.departments,
  talent: c.talent ?? "",
  relationship: c.relationship ?? "",
  blocked: c.blocked,
  block_reason: c.blockReason ?? null,
  blocked_on: c.blockedOn ?? null,
  last_contact: c.lastContact || null,
  notes: c.notes,
});

const contactRow = (clientId: string, k: Contact) => ({
  client_id: clientId,
  name: k.name,
  designation: k.designation,
  nationality: k.nationality,
  dob: k.dob || null,
  race: k.race,
  gender: k.gender,
  religion: k.religion,
  phone: k.phone,
  email: k.email,
  reminder: k.reminder || null,
  notes: k.notes,
  talent: k.talent ?? "",
  relationship: k.relationship ?? "",
});

const patchRow = (p: Partial<Client>): any => {
  const r: Record<string, unknown> = {};
  if (p.company !== undefined) r["company"] = p.company;
  if (p.industry !== undefined) r["industry"] = p.industry;
  if (p.location !== undefined) r["location"] = p.location;
  if (p.website !== undefined) r["website"] = p.website;
  if (p.type !== undefined) r["type"] = p.type;
  if (p.departments !== undefined) r["departments"] = p.departments;
  if (p.talent !== undefined) r["talent"] = p.talent;
  if (p.relationship !== undefined) r["relationship"] = p.relationship;
  if (p.blocked !== undefined) r["blocked"] = p.blocked;
  if (p.blockReason !== undefined) r["block_reason"] = p.blockReason ?? null;
  if (p.blockedOn !== undefined) r["blocked_on"] = p.blockedOn ?? null;
  if (p.lastContact !== undefined) r["last_contact"] = p.lastContact || null;
  if (p.notes !== undefined) r["notes"] = p.notes;
  return r;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const g = globalThis as unknown as { __crmCtx?: React.Context<Ctx | null> };
const CrmContext = (g.__crmCtx ??= createContext<Ctx | null>(null));

const emptyLists: MasterLists = { types: [], departments: [], nationalities: [], religions: [] };

export function CrmProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const sessionQ = useQuery({
    queryKey: ["session"],
    queryFn: () => getSession(),
    staleTime: 60_000,
  });
  const userId = sessionQ.data?.id;
  const role = sessionQ.data?.role ?? null;

  const clientsQ = useQuery({
    queryKey: ["clients"],
    enabled: !!userId,
    queryFn: async () =>
      (await api.listClients()).map((c) => toClient(c, c.contacts.map(toContact))),
  });

  const mastersQ = useQuery({
    queryKey: ["master-options"],
    enabled: !!userId,
    queryFn: async () => {
      const data = await api.listMasterOptions();
      const lists: MasterLists = { types: [], departments: [], nationalities: [], religions: [] };
      for (const row of data ?? []) {
        if (row.category in lists) lists[row.category as MasterKey].push(row.value);
      }
      return lists;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["master-options"] });
  };
  const fail = (message: string, e: unknown): false => {
    console.error(e);
    toast.error(message);
    return false;
  };

  const value: Ctx = {
    clients: clientsQ.data ?? [],
    masterLists: mastersQ.data ?? emptyLists,
    loading: !!userId && (clientsQ.isLoading || mastersQ.isLoading),
    role,
    isAdmin: role === "admin",
    userEmail: sessionQ.data?.email ?? null,

    addClient: async (c) => {
      try {
        await api.addClient({ data: clientRow(limitClientFields(c)) });
      } catch (e) {
        return fail("Could not add the client. Only admins can make changes.", e);
      }
      refresh();
      return true;
    },

    updateClient: async (id, patch) => {
      try {
        await api.updateClient({ data: { id, patch: patchRow(patch) } });
      } catch (e) {
        return fail("Could not save. Only admins can make changes.", e);
      }
      refresh();
      return true;
    },

    upsertContact: async (cid, ct) => {
      try {
        await api.upsertContact({ data: { id: ct.id, ...contactRow(cid, ct) } });
      } catch (e) {
        return fail("Could not save the contact. Only admins can make changes.", e);
      }
      refresh();
      return true;
    },

    removeContact: async (_cid, kid) => {
      try {
        await api.removeContact({ data: { id: kid } });
      } catch (e) {
        return fail("Could not remove the contact. Only admins can make changes.", e);
      }
      refresh();
      return true;
    },

    removeClient: async (id) => {
      try {
        await api.removeClient({ data: { id } });
      } catch (e) {
        return fail("Could not remove the client. Only admins can make changes.", e);
      }
      refresh();
      return true;
    },

    addMasterOption: async (key, value) => {
      try {
        await api.addMasterOption({ data: { category: key, value } });
      } catch (e) {
        return fail("Could not add the value. Only admins can make changes.", e);
      }
      refresh();
      return true;
    },

    renameMasterOption: async (key, oldValue, value) => {
      // The server also renames the value on every client and contact that uses it.
      try {
        await api.renameMasterOption({ data: { category: key, oldValue, value } });
      } catch (e) {
        return fail("Could not rename the value. Only admins can make changes.", e);
      }
      refresh();
      return true;
    },

    removeMasterOption: async (key, value) => {
      try {
        await api.removeMasterOption({ data: { category: key, value } });
      } catch (e) {
        return fail("Could not remove the value. Only admins can make changes.", e);
      }
      refresh();
      return true;
    },
  };

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be inside CrmProvider");
  return ctx;
}

export const fmtDate = (d?: string) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const initials = (s: string) =>
  s
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const emptyContact = (): Contact => ({
  id: uid(),
  name: "",
  designation: "",
  nationality: "",
  dob: "",
  race: "",
  gender: "",
  religion: "",
  phone: "",
  email: "",
  reminder: "",
  notes: "",
  talent: "",
  relationship: "",
});
