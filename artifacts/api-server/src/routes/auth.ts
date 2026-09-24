import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { db, passwordResetTokensTable, permissionsTable, rolePermissionsTable, rolesTable, usersTable } from "@workspace/db";
import { getAuthUser, requireAuth, ROLE_LABELS, ROLE_PERMISSIONS, signAuthToken } from "../lib/auth";
import { createRateLimit } from "../lib/security";

const router: IRouter = Router();
const loginRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const passwordResetRequestRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 3 });
const passwordResetCompleteRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 8 });
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const PasswordResetRequestBody = z.object({
  email: z.string().trim().email("Email inválido").max(254).transform((value) => value.toLowerCase()),
});

const PasswordResetCompleteBody = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i, "Link inválido ou expirado"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(128),
});

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function requireLocalPasswordReset(req: Request, res: Response, next: NextFunction) {
  const remoteAddress = req.socket.remoteAddress?.replace(/^::ffff:/, "");
  const isLoopback = remoteAddress === "127.0.0.1" || remoteAddress === "::1";
  const localPort = process.env.LOCAL_APP_PORT || "5173";
  const localOrigins = new Set([
    `http://localhost:${localPort}`,
    `http://127.0.0.1:${localPort}`,
  ]);
  const isLocalRequest = process.env.NODE_ENV === "development"
    && !process.env.VERCEL
    && isLoopback
    && localOrigins.has(req.get("origin") ?? "");

  if (!isLocalRequest) {
    res.status(404).json({ error: "A recuperação de senha está disponível somente no painel local." });
    return;
  }

  next();
}

const LoginBody = z.object({
  email: z.string().trim().email("Email inválido").transform((value) => value.toLowerCase()),
  password: z.string().min(6),
});

const CreateUserBody = z.object({
  name: z.string().trim().min(2, "Nome obrigatório"),
  email: z.string().trim().email("Email inválido").transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  role: z.enum(["owner", "manager", "finance", "production", "stock", "attendant"]),
  active: z.boolean().optional().default(true),
});

const UpdateUserBody = z.object({
  name: z.string().trim().min(2, "Nome obrigatório").optional(),
  email: z.string().trim().email("Email inválido").transform((value) => value.toLowerCase()).optional(),
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

router.post("/auth/login", loginRateLimit, async (req, res): Promise<void> => {
  await ensureAuthDefaults();
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (!user || !user.active) { res.status(401).json({ error: "Email ou senha invalidos" }); return; }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) { res.status(401).json({ error: "Email ou senha invalidos" }); return; }

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
  const authUser = await getAuthUser(user.id);
  if (!authUser) { res.status(401).json({ error: "Usuario inativo" }); return; }
  res.json({ token: signAuthToken(authUser), user: authUser });
});

router.post("/auth/password-reset/local/request", requireLocalPasswordReset, passwordResetRequestRateLimit, async (req, res): Promise<void> => {
  const parsed = PasswordResetRequestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Email inválido" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (!user || !user.active) {
    res.status(404).json({ error: "Não encontramos um usuário ativo com esse e-mail." });
    return;
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, user.id));
  await db.insert(passwordResetTokensTable).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  res.json({ token });
});

router.post("/auth/password-reset/local/complete", requireLocalPasswordReset, passwordResetCompleteRateLimit, async (req, res): Promise<void> => {
  const parsed = PasswordResetCompleteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }); return; }

  const tokenHash = hashResetToken(parsed.data.token);
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const now = new Date();

  const completed = await db.transaction(async (tx) => {
    const [reset] = await tx.select().from(passwordResetTokensTable)
      .where(and(
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        isNull(passwordResetTokensTable.usedAt),
        gt(passwordResetTokensTable.expiresAt, now),
      ))
      .for("update")
      .limit(1);
    if (!reset) return false;

    const [claimed] = await tx.update(passwordResetTokensTable)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokensTable.id, reset.id), isNull(passwordResetTokensTable.usedAt)))
      .returning({ id: passwordResetTokensTable.id });
    if (!claimed) return false;

    await tx.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, reset.userId));
    await tx.update(passwordResetTokensTable).set({ usedAt: now }).where(and(
      eq(passwordResetTokensTable.userId, reset.userId),
      isNull(passwordResetTokensTable.usedAt),
    ));
    return true;
  });

  if (!completed) { res.status(400).json({ error: "Este link é inválido ou expirou. Solicite uma nova redefinição." }); return; }
  res.json({ message: "Senha alterada com sucesso. Faça login com a nova senha." });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  await ensureAuthDefaults();
  const freshUser = req.user?.id ? await getAuthUser(req.user.id) : null;
  if (!freshUser) { res.status(401).json({ error: "Sessão inválida" }); return; }
  res.json({ user: freshUser });
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
    email: parsed.data.email,
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
  if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
  if (parsed.data.role !== undefined) updateData.roleName = parsed.data.role;
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;
  if (parsed.data.password) updateData.passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

router.delete("/auth/users/:id", requireAuth, async (req, res): Promise<void> => {
  if (!canManageUsers(req)) { res.status(403).json({ error: "Permission denied" }); return; }
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (req.user?.id === id) { res.status(400).json({ error: "Você não pode excluir o próprio usuário." }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.roleName === "owner" && req.user?.role !== "owner") {
    res.status(403).json({ error: "Somente a proprietária pode excluir outro perfil de proprietária." });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

export default router;
