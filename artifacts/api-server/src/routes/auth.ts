import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, permissionsTable, rolePermissionsTable, rolesTable, usersTable } from "@workspace/db";
import { getAuthUser, requireAuth, ROLE_LABELS, ROLE_PERMISSIONS, signAuthToken } from "../lib/auth";

const router: IRouter = Router();

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const CreateUserBody = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["owner", "manager", "finance", "production", "stock", "attendant"]),
  active: z.boolean().optional().default(true),
});

const UpdateUserBody = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["owner", "manager", "finance", "production", "stock", "attendant"]).optional(),
  active: z.boolean().optional(),
});

function canManageUsers(req: { user?: { permissions: string[] } }) {
  const permissions = req.user?.permissions ?? [];
  return permissions.includes("*") || permissions.includes("users");
}

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.roleName,
    roleLabel: ROLE_LABELS[user.roleName] ?? user.roleName,
    active: user.active,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

async function ensureAuthDefaults() {
  for (const [name, label] of Object.entries(ROLE_LABELS)) {
    await db.insert(rolesTable).values({ name, label }).onConflictDoUpdate({
      target: rolesTable.name,
      set: { label },
    });
  }

  const permissions = Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat().filter((key) => key !== "*")));
  for (const key of permissions) {
    await db.insert(permissionsTable).values({ key, label: key }).onConflictDoUpdate({
      target: permissionsTable.key,
      set: { label: key },
    });
  }

  for (const [roleName, rolePermissions] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permissionKey of rolePermissions.filter((key) => key !== "*")) {
      await db.insert(rolePermissionsTable).values({ roleName, permissionKey }).onConflictDoNothing();
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail.toLowerCase()));
    if (!existing) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await db.insert(usersTable).values({
        name: process.env.ADMIN_NAME || "Rochelle Ataide",
        email: adminEmail.toLowerCase(),
        passwordHash,
        roleName: "owner",
        active: true,
      });
    }
  }
}

router.get("/auth/setup", async (_req, res): Promise<void> => {
  await ensureAuthDefaults();
  const users = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  res.json({ hasUsers: users.length > 0 });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  await ensureAuthDefaults();
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email.toLowerCase()));
  if (!user || !user.active) { res.status(401).json({ error: "Email ou senha invalidos" }); return; }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) { res.status(401).json({ error: "Email ou senha invalidos" }); return; }

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
  const authUser = await getAuthUser(user.id);
  if (!authUser) { res.status(401).json({ error: "Usuario inativo" }); return; }
  res.json({ token: signAuthToken(authUser), user: authUser });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  res.json({ user: req.user });
});

router.get("/auth/users", requireAuth, async (req, res): Promise<void> => {
  if (!canManageUsers(req)) { res.status(403).json({ error: "Permission denied" }); return; }
  const rows = await db.select().from(usersTable).orderBy(usersTable.name);
  res.json(rows.map(formatUser));
});

router.post("/auth/users", requireAuth, async (req, res): Promise<void> => {
  if (!canManageUsers(req)) { res.status(403).json({ error: "Permission denied" }); return; }
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await db.insert(usersTable).values({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    passwordHash,
    roleName: parsed.data.role,
    active: parsed.data.active,
  }).returning();
  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.roleName,
    roleLabel: ROLE_LABELS[user.roleName] ?? user.roleName,
    active: user.active,
  });
});

router.patch("/auth/users/:id", requireAuth, async (req, res): Promise<void> => {
  if (!canManageUsers(req)) { res.status(403).json({ error: "Permission denied" }); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.email !== undefined) updateData.email = parsed.data.email.toLowerCase();
  if (parsed.data.role !== undefined) updateData.roleName = parsed.data.role;
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;
  if (parsed.data.password) updateData.passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

export default router;
