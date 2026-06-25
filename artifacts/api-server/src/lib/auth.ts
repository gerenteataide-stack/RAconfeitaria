import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, rolePermissionsTable, usersTable } from "@workspace/db";

export const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietaria",
  manager: "Gerente",
  finance: "Financeiro",
  production: "Producao",
  stock: "Estoquista",
  attendant: "Atendente",
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ["*"],
  manager: ["dashboard", "orders", "customers", "products", "production", "stock", "recipes", "financial", "marketing", "delivery", "notifications"],
  finance: ["dashboard", "financial"],
  production: ["dashboard", "production", "recipes", "products"],
  stock: ["dashboard", "stock", "products"],
  attendant: ["dashboard", "orders", "customers"],
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  permissions: string[];
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function jwtSecret() {
  return process.env.JWT_SECRET || "ra-confeitaria-dev-secret-change-me";
}

export function signAuthToken(user: AuthUser) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, role: user.role },
    jwtSecret(),
    { expiresIn: "8h" },
  );
}

export async function getUserPermissions(role: string) {
  if (role === "owner") return ["*"];
  const rows = await db.select().from(rolePermissionsTable).where(eq(rolePermissionsTable.roleName, role));
  const saved = rows.map((row) => row.permissionKey);
  return saved.length > 0 ? saved : ROLE_PERMISSIONS[role] ?? [];
}

export async function getAuthUser(userId: number): Promise<AuthUser | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || !user.active) return null;
  const permissions = await getUserPermissions(user.roleName);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.roleName,
    roleLabel: ROLE_LABELS[user.roleName] ?? user.roleName,
    permissions,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
    const userId = Number(payload.sub);
    const user = Number.isFinite(userId) ? await getAuthUser(userId) : null;
    if (!user) {
      res.status(401).json({ error: "Invalid session" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid session" });
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const permissions = req.user?.permissions ?? [];
    if (permissions.includes("*") || permissions.includes(permission)) {
      next();
      return;
    }
    res.status(403).json({ error: "Permission denied" });
  };
}
