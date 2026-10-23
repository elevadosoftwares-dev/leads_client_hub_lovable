import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { limitClientFields } from "@/lib/crm-rules";
import {
  addMasterOption as addMasterOptionFn,
  deleteClient,
  deleteContact,
  getCrmData,
  removeMasterOption as removeMasterOptionFn,
  renameMasterOption as renameMasterOptionFn,
  saveClient,
  saveContact,
  type CrmData,
} from "@/lib/crm.functions";

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
  relationship?: (typeof RELATIONSHIPS)[number];
  blocked: boolean;
  blockReason?: string | undefined;
  blockedOn?: string | undefined;
  lastContact: string;
  notes: string;
  contacts: Contact[];
};

/** Random id that also works on plain-http hosts, where crypto.randomUUID is unavailable. */
export const uid = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

type Ctx = {
  status: "loading" | "error" | "ready";
  retry: () => void;
  clients: Client[];
  masterLists: MasterLists;
  addMasterOption: (key: MasterKey, value: string) => void;
  renameMasterOption: (key: MasterKey, oldValue: string, value: string) => void;
  removeMasterOption: (key: MasterKey, value: string) => void;
  addClient: (c: Client) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  upsertContact: (clientId: string, contact: Contact) => void;
  removeContact: (clientId: string, contactId: string) => void;
  removeClient: (id: string) => void;
};

const CrmContext = createContext<Ctx | null>(null);

export const CRM_QUERY_KEY = ["crm"] as const;
const EMPTY: CrmData = {
  clients: [],
  masterLists: { types: [], departments: [], nationalities: [], religions: [] },
};
/** Typing into a client field saves once the user pauses, not on every keystroke. */
const CLIENT_SAVE_DELAY_MS = 400;

/** Server errors arrive as plain messages; validation errors as a JSON list of issues. */
function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const issues = JSON.parse(message) as { message?: string }[];
    if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
  } catch {
    // Not JSON - use the message as is.
  }
  return message || "Something went wrong.";
}

const toClientInput = ({ contacts: _contacts, ...client }: Client) => client;

/**
 * Holds the CRM data loaded from SQL Server. Changes are applied to the cached data right away
 * (so the screens stay responsive) and then saved through server functions; if a save fails,
 * the user sees why and the data is reloaded from the database.
 */
export function CrmProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: CRM_QUERY_KEY,
    queryFn: () => getCrmData(),
    refetchOnWindowFocus: false,
  });
  const data = query.data ?? EMPTY;
  const clientSaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = clientSaveTimers.current;
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  const current = () => queryClient.getQueryData<CrmData>(CRM_QUERY_KEY) ?? EMPTY;
  const change = (fn: (d: CrmData) => CrmData) =>
    queryClient.setQueryData<CrmData>(CRM_QUERY_KEY, (d) => fn(d ?? EMPTY));
  const persist = (save: Promise<unknown>) =>
    save.catch((error: unknown) => {
      toast.error(errorMessage(error));
      void queryClient.invalidateQueries({ queryKey: CRM_QUERY_KEY });
    });
  const saveClientNow = (id: string) => {
    clearTimeout(clientSaveTimers.current.get(id));
    clientSaveTimers.current.delete(id);
    const client = current().clients.find((c) => c.id === id);
    if (client) return persist(saveClient({ data: toClientInput(client) }));
    return Promise.resolve();
  };
  const scheduleClientSave = (id: string) => {
    clearTimeout(clientSaveTimers.current.get(id));
    clientSaveTimers.current.set(
      id,
      setTimeout(() => void saveClientNow(id), CLIENT_SAVE_DELAY_MS),
    );
  };
  const setClients = (fn: (clients: Client[]) => Client[]) =>
    change((d) => ({ ...d, clients: fn(d.clients) }));

  const value: Ctx = {
    status: query.data ? "ready" : query.isError ? "error" : "loading",
    retry: () => void query.refetch(),
    clients: data.clients,
    masterLists: data.masterLists,
    addMasterOption: (key, value) => {
      change((d) => ({
        ...d,
        masterLists: { ...d.masterLists, [key]: [...d.masterLists[key], value] },
      }));
      void persist(addMasterOptionFn({ data: { key, value } }));
    },
    renameMasterOption: (key, oldValue, value) => {
      change((d) => ({
        masterLists: {
          ...d.masterLists,
          [key]: d.masterLists[key].map((entry) => (entry === oldValue ? value : entry)),
        },
        clients: d.clients.map((client) => ({
          ...client,
          type: key === "types" && client.type === oldValue ? value : client.type,
          departments:
            key === "departments"
              ? [
                  ...new Set(
                    client.departments.map((entry) => (entry === oldValue ? value : entry)),
                  ),
                ]
              : client.departments,
          contacts: client.contacts.map((contact) => ({
            ...contact,
            nationality:
              key === "nationalities" && contact.nationality === oldValue
                ? value
                : contact.nationality,
            religion:
              key === "religions" && contact.religion === oldValue ? value : contact.religion,
          })),
        })),
      }));
      void persist(renameMasterOptionFn({ data: { key, oldValue, value } }));
    },
    removeMasterOption: (key, value) => {
      change((d) => ({
        ...d,
        masterLists: {
          ...d.masterLists,
          [key]: d.masterLists[key].filter((entry) => entry !== value),
        },
      }));
      void persist(removeMasterOptionFn({ data: { key, value } }));
    },
    addClient: (client) => {
      setClients((cs) => [limitClientFields(client), ...cs]);
      void saveClientNow(client.id);
    },
    updateClient: (id, patch) => {
      setClients((cs) => cs.map((x) => (x.id === id ? limitClientFields({ ...x, ...patch }) : x)));
      scheduleClientSave(id);
    },
    upsertContact: (clientId, contact) => {
      setClients((cs) =>
        cs.map((x) =>
          x.id !== clientId
            ? x
            : {
                ...x,
                contacts: x.contacts.some((k) => k.id === contact.id)
                  ? x.contacts.map((k) => (k.id === contact.id ? contact : k))
                  : [...x.contacts, contact],
              },
        ),
      );
      // A just-created or just-edited client must reach the database before its contacts.
      const pending = clientSaveTimers.current.has(clientId)
        ? saveClientNow(clientId)
        : Promise.resolve();
      void pending.then(() => persist(saveContact({ data: { clientId, contact } })));
    },
    removeClient: (id) => {
      clearTimeout(clientSaveTimers.current.get(id));
      clientSaveTimers.current.delete(id);
      setClients((cs) => cs.filter((x) => x.id !== id));
      void persist(deleteClient({ data: { id } }));
    },
    removeContact: (clientId, contactId) => {
      setClients((cs) =>
        cs.map((x) =>
          x.id !== clientId ? x : { ...x, contacts: x.contacts.filter((k) => k.id !== contactId) },
        ),
      );
      void persist(deleteContact({ data: { id: contactId } }));
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
