import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { RoleCode } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { AppError } from "./errors";
import { hasPermission, type Permission } from "./permissions";

export const SESSION_COOKIE = "kiju_session";
export const CSRF_COOKIE = "kiju_csrf";

const SESSION_DAYS = 14;

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: RoleCode;
};

function hashToken(token: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "dev-secret"}:${token}`)
    .digest("hex");
}

function cookieOptions(httpOnly = true) {
  return {
    httpOnly,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    ...cookieOptions(true),
    expires: expiresAt,
  });
  cookieStore.set(CSRF_COOKIE, csrfToken, {
    ...cookieOptions(false),
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(CSRF_COOKIE);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { role: true } } },
  });

  if (!session || session.expiresAt < new Date() || !session.user.active) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role.code,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Bitte anmelden.");
  }
  return user;
}

export function requirePermission(user: CurrentUser, permission: Permission) {
  if (!hasPermission(user.role, permission)) {
    throw new AppError(403, "FORBIDDEN", "Dafür fehlen die Berechtigungen.");
  }
}

export function requireRole(user: CurrentUser, roles: RoleCode[]) {
  if (!roles.includes(user.role)) {
    throw new AppError(403, "FORBIDDEN", "Dafür fehlen die Berechtigungen.");
  }
}

export async function verifyCsrf(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get("x-csrf-token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw new AppError(403, "CSRF_INVALID", "Sicherheitsprüfung fehlgeschlagen.");
  }
}
