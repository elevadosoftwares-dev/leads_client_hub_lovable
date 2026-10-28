import { createServerFn } from "@tanstack/react-start";

import { requireAdmin } from "@/lib/auth-middleware";

/** This address is always an administrator (as in the original system); everyone else starts view-only. */
const DEFAULT_ADMIN_EMAIL = "ops@leads1.com";

function validateUserId(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId ?? "")) throw new Error("Missing user");
}

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { request } = await import("@/server/db.server");
    const req = await request();
    const { recordset } = await req.query<{
      id: string;
      email: string;
      created_at: Date;
      role: "admin" | "user";
    }>(`SELECT id, email, created_at, role FROM dbo.users ORDER BY created_at`);
    return recordset.map((u) => ({
      id: u.id.toLowerCase(),
      email: u.email,
      createdAt: u.created_at.toISOString(),
      role: u.role,
    }));
  });

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { email: string; password: string }) => {
    if (!input?.email?.includes("@")) throw new Error("Enter a valid email address");
    if (!input.password || input.password.length < 8)
      throw new Error("Password must be at least 8 characters");
    return { email: input.email.trim().toLowerCase(), password: input.password };
  })
  .handler(async ({ data }) => {
    const { request, sql, isDuplicateKeyError } = await import("@/server/db.server");
    const { hashPassword } = await import("@/server/crypto.server");
    const req = await request();
    try {
      await req
        .input("email", sql.NVarChar(320), data.email)
        .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
        .input("role", sql.NVarChar(10), data.email === DEFAULT_ADMIN_EMAIL ? "admin" : "user")
        .query(
          `INSERT INTO dbo.users (email, password_hash, role) VALUES (@email, @password_hash, @role)`,
        );
    } catch (error) {
      if (isDuplicateKeyError(error))
        throw new Error("A user with this email address has already been registered");
      throw error;
    }
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { userId: string; role: "admin" | "user" }) => {
    validateUserId(input.userId);
    if (input.role !== "admin" && input.role !== "user") throw new Error("Invalid role");
    return input;
  })
  .handler(async ({ data, context }) => {
    if (data.userId.toLowerCase() === context.user.userId)
      throw new Error("You cannot change your own role");
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req
      .input("id", sql.UniqueIdentifier, data.userId)
      .input("role", sql.NVarChar(10), data.role)
      .query(`UPDATE dbo.users SET role = @role WHERE id = @id`);
    return { ok: true };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { userId: string }) => {
    validateUserId(input.userId);
    return input;
  })
  .handler(async ({ data, context }) => {
    if (data.userId.toLowerCase() === context.user.userId)
      throw new Error("You cannot delete your own account");
    const { request, sql } = await import("@/server/db.server");
    const req = await request();
    await req
      .input("id", sql.UniqueIdentifier, data.userId)
      .query(`DELETE FROM dbo.users WHERE id = @id`);
    return { ok: true };
  });

/** Replaces the e-mailed reset link: an administrator sets a new password for the user. */
export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { userId: string; password: string }) => {
    validateUserId(input.userId);
    if (!input.password || input.password.length < 8)
      throw new Error("Password must be at least 8 characters");
    return input;
  })
  .handler(async ({ data }) => {
    const { request, sql } = await import("@/server/db.server");
    const { hashPassword } = await import("@/server/crypto.server");
    const req = await request();
    // Also signs the user out everywhere, so the old password stops working immediately.
    await req
      .input("id", sql.UniqueIdentifier, data.userId)
      .input("password_hash", sql.NVarChar(256), await hashPassword(data.password))
      .query(
        `UPDATE dbo.users SET password_hash = @password_hash WHERE id = @id;
         DELETE FROM dbo.sessions WHERE user_id = @id;`,
      );
    return { ok: true };
  });
