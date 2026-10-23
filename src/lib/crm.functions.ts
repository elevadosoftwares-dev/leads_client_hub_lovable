import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Client, Contact, MasterKey, MasterLists } from "@/lib/crm";
import { SPECIAL_NOTE_LIMIT, TALENT_LIMIT } from "@/lib/crm-rules";

export type CrmData = { clients: Client[]; masterLists: MasterLists };

const MASTER_KEYS = ["types", "departments", "nationalities", "religions"] as const;

const id = z.string().trim().min(1).max(50);
const text = (max: number) => z.string().trim().max(max);
const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.")]);
const optional = (max: number) => z.string().trim().max(max).optional();

const contactSchema = z.object({
  id,
  name: z.string().trim().min(1, "Enter the contact's name.").max(100),
  designation: text(100),
  nationality: text(100),
  dob: date,
  race: text(50),
  gender: text(20),
  religion: text(100),
  phone: text(25),
  email: text(255),
  reminder: date,
  notes: text(1000),
  talent: optional(TALENT_LIMIT),
  relationship: optional(20),
});

const clientSchema = z.object({
  id,
  company: z.string().trim().min(1, "Enter a company name.").max(200),
  industry: text(200),
  location: text(200),
  website: text(255),
  type: text(100),
  departments: z.array(text(100)).max(50),
  talent: optional(TALENT_LIMIT),
  relationship: optional(20),
  blocked: z.boolean(),
  blockReason: optional(200),
  blockedOn: z.union([date, z.undefined()]),
  lastContact: date,
  notes: text(SPECIAL_NOTE_LIMIT),
});

const masterKey = z.enum(MASTER_KEYS);
const masterValue = z.string().trim().min(1, "Enter a value.").max(100);

/** Converts a DATE column (returned as a UTC Date) to "YYYY-MM-DD", or "" when NULL. */
const ymd = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");
const nullIfEmpty = (value: string | undefined) => (value ? value : null);

type ClientRow = {
  id: string;
  company: string;
  industry: string;
  location: string;
  website: string;
  type: string;
  talent: string | null;
  relationship: string | null;
  blocked: boolean;
  block_reason: string | null;
  blocked_on: Date | null;
  last_contact: Date | null;
  notes: string;
};

type ContactRow = {
  id: string;
  client_id: string;
  name: string;
  designation: string;
  nationality: string;
  dob: Date | null;
  race: string;
  gender: string;
  religion: string;
  phone: string;
  email: string;
  reminder: Date | null;
  notes: string;
  talent: string | null;
  relationship: string | null;
};

/** Everything the CRM screens need: all clients with their contacts, and the master lists. */
export const getCrmData = createServerFn({ method: "GET" }).handler(async (): Promise<CrmData> => {
  const { request } = await import("@/server/db.server");
  const [options, clientRows, departmentRows, contactRows] = await Promise.all([
    request().then((r) =>
      r.query<{ category: MasterKey; value: string }>(
        `SELECT category, value FROM dbo.master_options ORDER BY category, sort_order, value`,
      ),
    ),
    request().then((r) =>
      r.query<ClientRow>(
        `SELECT id, company, industry, location, website, type, talent, relationship, blocked,
                block_reason, blocked_on, last_contact, notes
           FROM dbo.clients ORDER BY seq DESC`,
      ),
    ),
    request().then((r) =>
      r.query<{ client_id: string; department: string }>(
        `SELECT client_id, department FROM dbo.client_departments`,
      ),
    ),
    request().then((r) =>
      r.query<ContactRow>(
        `SELECT id, client_id, name, designation, nationality, dob, race, gender, religion, phone,
                email, reminder, notes, talent, relationship
           FROM dbo.contacts ORDER BY seq`,
      ),
    ),
  ]);

  const masterLists: MasterLists = { types: [], departments: [], nationalities: [], religions: [] };
  for (const { category, value } of options.recordset) masterLists[category]?.push(value);

  const departments = new Map<string, string[]>();
  for (const { client_id, department } of departmentRows.recordset) {
    departments.set(client_id, [...(departments.get(client_id) ?? []), department]);
  }

  const contacts = new Map<string, Contact[]>();
  for (const k of contactRows.recordset) {
    const contact: Contact = {
      id: k.id,
      name: k.name,
      designation: k.designation,
      nationality: k.nationality,
      dob: ymd(k.dob),
      race: k.race,
      gender: k.gender,
      religion: k.religion,
      phone: k.phone,
      email: k.email,
      reminder: ymd(k.reminder),
      notes: k.notes,
      talent: k.talent ?? "",
      relationship: k.relationship ?? "",
    };
    contacts.set(k.client_id, [...(contacts.get(k.client_id) ?? []), contact]);
  }

  const clients = clientRows.recordset.map((c): Client => {
    const client: Client = {
      id: c.id,
      company: c.company,
      industry: c.industry,
      location: c.location,
      website: c.website,
      type: c.type,
      departments: departments.get(c.id) ?? [],
      talent: c.talent ?? "",
      blocked: c.blocked,
      blockReason: c.block_reason ?? undefined,
      blockedOn: c.blocked_on ? ymd(c.blocked_on) : undefined,
      lastContact: ymd(c.last_contact),
      notes: c.notes,
      contacts: contacts.get(c.id) ?? [],
    };
    if (c.relationship) client.relationship = c.relationship as NonNullable<Client["relationship"]>;
    return client;
  });

  return { clients, masterLists };
});

/** Creates the client if its id is new, otherwise updates it. Contacts are saved separately. */
export const saveClient = createServerFn({ method: "POST" })
  .validator((d: unknown) => clientSchema.parse(d))
  .handler(async ({ data }) => {
    const { transaction, sql, isDuplicateKeyError } = await import("@/server/db.server");
    try {
      await transaction(async (tx) => {
        await new sql.Request(tx)
          .input("id", sql.NVarChar(50), data.id)
          .input("company", sql.NVarChar(200), data.company)
          .input("industry", sql.NVarChar(200), data.industry)
          .input("location", sql.NVarChar(200), data.location)
          .input("website", sql.NVarChar(255), data.website)
          .input("type", sql.NVarChar(100), data.type)
          .input("talent", sql.NVarChar(30), nullIfEmpty(data.talent))
          .input("relationship", sql.NVarChar(20), nullIfEmpty(data.relationship))
          .input("blocked", sql.Bit, data.blocked)
          .input(
            "block_reason",
            sql.NVarChar(200),
            data.blocked ? nullIfEmpty(data.blockReason) : null,
          )
          .input("blocked_on", sql.Date, data.blocked ? nullIfEmpty(data.blockedOn) : null)
          .input("last_contact", sql.Date, nullIfEmpty(data.lastContact))
          .input("notes", sql.NVarChar(50), data.notes).query(`
            UPDATE dbo.clients
               SET company = @company, industry = @industry, location = @location,
                   website = @website, type = @type, talent = @talent,
                   relationship = @relationship, blocked = @blocked,
                   block_reason = @block_reason, blocked_on = @blocked_on,
                   last_contact = @last_contact, notes = @notes, updated_at = SYSUTCDATETIME()
             WHERE id = @id;
            IF @@ROWCOUNT = 0
              INSERT INTO dbo.clients (id, company, industry, location, website, type, talent,
                                       relationship, blocked, block_reason, blocked_on,
                                       last_contact, notes)
              VALUES (@id, @company, @industry, @location, @website, @type, @talent,
                      @relationship, @blocked, @block_reason, @blocked_on, @last_contact, @notes);
            DELETE FROM dbo.client_departments WHERE client_id = @id;`);
        for (const department of new Set(data.departments.filter(Boolean))) {
          await new sql.Request(tx)
            .input("id", sql.NVarChar(50), data.id)
            .input("department", sql.NVarChar(100), department)
            .query(
              `INSERT INTO dbo.client_departments (client_id, department) VALUES (@id, @department)`,
            );
        }
      });
    } catch (error) {
      if (isDuplicateKeyError(error))
        throw new Error(`A client named "${data.company}" already exists.`);
      throw error;
    }
    return { ok: true };
  });

/** Deletes the client; its contacts and departments go with it (ON DELETE CASCADE). */
export const deleteClient = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    await (
      await request()
    )
      .input("id", sql.NVarChar(50), data.id)
      .query(`DELETE FROM dbo.clients WHERE id = @id`);
    return { ok: true };
  });

/** Creates the contact if its id is new, otherwise updates it. */
export const saveContact = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ clientId: id, contact: contactSchema }).parse(d))
  .handler(async ({ data: { clientId, contact: k } }) => {
    const { request, sql } = await import("@/server/db.server");
    await (
      await request()
    )
      .input("id", sql.NVarChar(50), k.id)
      .input("client_id", sql.NVarChar(50), clientId)
      .input("name", sql.NVarChar(100), k.name)
      .input("designation", sql.NVarChar(100), k.designation)
      .input("nationality", sql.NVarChar(100), k.nationality)
      .input("dob", sql.Date, nullIfEmpty(k.dob))
      .input("race", sql.NVarChar(50), k.race)
      .input("gender", sql.NVarChar(20), k.gender)
      .input("religion", sql.NVarChar(100), k.religion)
      .input("phone", sql.NVarChar(25), k.phone)
      .input("email", sql.NVarChar(255), k.email)
      .input("reminder", sql.Date, nullIfEmpty(k.reminder))
      .input("notes", sql.NVarChar(1000), k.notes)
      .input("talent", sql.NVarChar(30), nullIfEmpty(k.talent))
      .input("relationship", sql.NVarChar(20), nullIfEmpty(k.relationship)).query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.clients WHERE id = @client_id)
          THROW 50001, N'That client no longer exists.', 1;
        UPDATE dbo.contacts
           SET client_id = @client_id, name = @name, designation = @designation,
               nationality = @nationality, dob = @dob, race = @race, gender = @gender,
               religion = @religion, phone = @phone, email = @email, reminder = @reminder,
               notes = @notes, talent = @talent, relationship = @relationship,
               updated_at = SYSUTCDATETIME()
         WHERE id = @id;
        IF @@ROWCOUNT = 0
          INSERT INTO dbo.contacts (id, client_id, name, designation, nationality, dob, race,
                                    gender, religion, phone, email, reminder, notes, talent,
                                    relationship)
          VALUES (@id, @client_id, @name, @designation, @nationality, @dob, @race, @gender,
                  @religion, @phone, @email, @reminder, @notes, @talent, @relationship);`);
    return { ok: true };
  });

export const deleteContact = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    await (
      await request()
    )
      .input("id", sql.NVarChar(50), data.id)
      .query(`DELETE FROM dbo.contacts WHERE id = @id`);
    return { ok: true };
  });

export const addMasterOption = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ key: masterKey, value: masterValue }).parse(d))
  .handler(async ({ data }) => {
    const { request, sql, isDuplicateKeyError } = await import("@/server/db.server");
    try {
      await (
        await request()
      )
        .input("category", sql.NVarChar(20), data.key)
        .input("value", sql.NVarChar(100), data.value).query(`
          INSERT INTO dbo.master_options (category, value, sort_order)
          SELECT @category, @value, ISNULL(MAX(sort_order), 0) + 1
            FROM dbo.master_options WHERE category = @category`);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new Error(`"${data.value}" already exists.`);
      throw error;
    }
    return { ok: true };
  });

/** Renames a master-list value and every client/contact that uses it, in one transaction. */
export const renameMasterOption = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ key: masterKey, oldValue: masterValue, value: masterValue }).parse(d),
  )
  .handler(async ({ data }) => {
    const { transaction, sql, isDuplicateKeyError } = await import("@/server/db.server");
    const propagate = {
      types: `UPDATE dbo.clients SET type = @value WHERE type = @old`,
      departments: `UPDATE dbo.client_departments SET department = @value
                     WHERE department = @old
                       AND client_id NOT IN (SELECT client_id FROM dbo.client_departments WHERE department = @value);
                    DELETE FROM dbo.client_departments WHERE department = @old`,
      nationalities: `UPDATE dbo.contacts SET nationality = @value WHERE nationality = @old`,
      religions: `UPDATE dbo.contacts SET religion = @value WHERE religion = @old`,
    }[data.key];
    try {
      await transaction(async (tx) => {
        await new sql.Request(tx)
          .input("category", sql.NVarChar(20), data.key)
          .input("old", sql.NVarChar(100), data.oldValue)
          .input("value", sql.NVarChar(100), data.value)
          .query(
            `UPDATE dbo.master_options SET value = @value WHERE category = @category AND value = @old;
             ${propagate}`,
          );
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new Error(`"${data.value}" already exists.`);
      throw error;
    }
    return { ok: true };
  });

export const removeMasterOption = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ key: masterKey, value: masterValue }).parse(d))
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    await (
      await request()
    )
      .input("category", sql.NVarChar(20), data.key)
      .input("value", sql.NVarChar(100), data.value)
      .query(`DELETE FROM dbo.master_options WHERE category = @category AND value = @value`);
    return { ok: true };
  });
