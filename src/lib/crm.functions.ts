import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/auth-middleware";

export type ContactRow = {
  id: string;
  client_id: string;
  name: string;
  designation: string;
  nationality: string;
  dob: string | null;
  race: string;
  gender: string;
  religion: string;
  phone: string;
  email: string;
  reminder: string | null;
  notes: string;
  talent: string;
  relationship: string;
  created_at: string;
};
export type ClientRow = {
  id: string;
  company: string;
  industry: string;
  location: string;
  website: string;
  type: string;
  departments: string[];
  talent: string;
  relationship: string;
  blocked: boolean;
  block_reason: string | null;
  blocked_on: string | null;
  last_contact: string | null;
  notes: string;
  created_at: string;
  contacts: ContactRow[];
};
export type MasterOption = { category: string; value: string };

const CONTACT_COLUMNS = `k.id, k.client_id, k.name, k.designation, k.nationality, k.dob, k.race, k.gender,
  k.religion, k.phone, k.email, k.reminder, k.notes, k.talent, k.relationship, k.created_at`;

// ------------------------------------------------------------------ reads (any signed-in user)

/** Every client with its contacts, newest first. */
export const listClients = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { selectJson } = await import("@/server/rows.server");
    const rows = await selectJson<ClientRow>(
      `SELECT c.id, c.company, c.industry, c.location, c.website, c.type,
              JSON_QUERY(c.departments) AS departments, c.talent, c.relationship, c.blocked,
              c.block_reason, c.blocked_on, c.last_contact, c.notes, c.created_at,
              JSON_QUERY((SELECT ${CONTACT_COLUMNS} FROM dbo.contacts k WHERE k.client_id = c.id
                          ORDER BY k.created_at FOR JSON PATH, INCLUDE_NULL_VALUES)) AS contacts
         FROM dbo.clients c ORDER BY c.created_at DESC, c.company`,
    );
    return rows.map((r) => ({
      ...r,
      departments: r.departments ?? [],
      contacts: r.contacts ?? [],
    }));
  });

export const listMasterOptions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { selectJson } = await import("@/server/rows.server");
    return selectJson<MasterOption>(
      `SELECT category, value FROM dbo.master_options ORDER BY value`,
    );
  });

// ------------------------------------------------------------------ writes (admins only)

const id = z.string().uuid();
const text = (max: number) => z.string().max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullish()
  .or(z.literal(""))
  .transform((v) => v || null);

const clientFields = z.object({
  company: text(300).trim().min(1, "Enter a company name."),
  industry: text(300),
  location: text(300),
  website: text(500),
  type: text(100),
  departments: z.array(text(200)).transform((v) => JSON.stringify(v)),
  talent: text(100_000),
  relationship: text(50),
  blocked: z.boolean(),
  block_reason: text(100_000)
    .nullish()
    .transform((v) => v ?? null),
  blocked_on: date,
  last_contact: date,
  notes: text(100_000),
});

const contactFields = z.object({
  name: text(200),
  designation: text(200),
  nationality: text(100),
  dob: date,
  race: text(100),
  gender: text(50),
  religion: text(100),
  phone: text(100),
  email: text(320),
  reminder: date,
  notes: text(100_000),
  talent: text(100_000),
  relationship: text(50),
});

export const addClient = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => clientFields.parse(d))
  .handler(async ({ data }) => {
    const { insertRow } = await import("@/server/rows.server");
    await insertRow("clients", data);
    return { ok: true };
  });

/** Saves only the fields that are present, like a partial update. */
export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id, patch: clientFields.partial() }).parse(d))
  .handler(async ({ data }) => {
    const { updateRow } = await import("@/server/rows.server");
    const patch = Object.fromEntries(Object.entries(data.patch).filter(([, v]) => v !== undefined));
    if (Object.keys(patch).length) await updateRow("clients", data.id, patch);
    return { ok: true };
  });

export const removeClient = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }) => {
    const { deleteRow } = await import("@/server/rows.server");
    // The client's contacts go with it (ON DELETE CASCADE).
    await deleteRow("clients", data.id);
    return { ok: true };
  });

/** Creates the contact, or updates it when a contact with this id already exists. */
export const upsertContact = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => contactFields.extend({ id, client_id: id }).parse(d))
  .handler(async ({ data }) => {
    const { execute } = await import("@/server/rows.server");
    const cols = Object.keys(contactFields.shape);
    await execute(
      `IF EXISTS (SELECT 1 FROM dbo.contacts WHERE id = @id)
         UPDATE dbo.contacts SET ${cols.map((c) => `${c} = @${c}`).join(", ")}
          WHERE id = @id AND client_id = @client_id;
       ELSE
         INSERT INTO dbo.contacts (id, client_id, ${cols.join(", ")})
         VALUES (@id, @client_id, ${cols.map((c) => `@${c}`).join(", ")});`,
      data,
    );
    return { ok: true };
  });

export const removeContact = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }) => {
    const { deleteRow } = await import("@/server/rows.server");
    await deleteRow("contacts", data.id);
    return { ok: true };
  });

const category = z.enum(["types", "departments", "nationalities", "religions"]);
const optionValue = text(200).trim().min(1, "Enter a value.");

export const addMasterOption = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ category, value: optionValue }).parse(d))
  .handler(async ({ data }) => {
    const { insertRow } = await import("@/server/rows.server");
    const { isDuplicateKeyError } = await import("@/server/db.server");
    try {
      await insertRow("master_options", data);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new Error(`"${data.value}" is already in the list.`);
      throw error;
    }
    return { ok: true };
  });

/** Renames a list value and every client/contact that uses it, in one transaction. */
export const renameMasterOption = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z.object({ category, oldValue: text(200), value: optionValue }).parse(d),
  )
  .handler(async ({ data }) => {
    const { execute } = await import("@/server/rows.server");
    const { isDuplicateKeyError } = await import("@/server/db.server");
    const propagate = {
      types: `UPDATE dbo.clients SET type = @value WHERE type = @oldValue;`,
      // Each department is a quoted JSON string inside the array, so replacing the quoted,
      // JSON-escaped name changes whole entries only.
      departments: `UPDATE dbo.clients
                       SET departments = REPLACE(departments,
                             N'"' + STRING_ESCAPE(@oldValue, 'json') + N'"',
                             N'"' + STRING_ESCAPE(@value, 'json') + N'"')
                     WHERE EXISTS (SELECT 1 FROM OPENJSON(departments) d WHERE d.value = @oldValue);`,
      nationalities: `UPDATE dbo.contacts SET nationality = @value WHERE nationality = @oldValue;`,
      religions: `UPDATE dbo.contacts SET religion = @value WHERE religion = @oldValue;`,
    }[data.category];
    try {
      await execute(
        `SET XACT_ABORT ON;
         BEGIN TRANSACTION;
           UPDATE dbo.master_options SET value = @value WHERE category = @category AND value = @oldValue;
           ${propagate}
         COMMIT TRANSACTION;`,
        data,
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new Error(`"${data.value}" is already in the list.`);
      throw error;
    }
    return { ok: true };
  });

export const removeMasterOption = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ category, value: text(200) }).parse(d))
  .handler(async ({ data }) => {
    const { execute } = await import("@/server/rows.server");
    await execute(
      `DELETE FROM dbo.master_options WHERE category = @category AND value = @value`,
      data,
    );
    return { ok: true };
  });
