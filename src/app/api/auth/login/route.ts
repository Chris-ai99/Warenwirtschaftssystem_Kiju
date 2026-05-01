import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createSession, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { ok, parseJson, route } from "@/lib/route";
import { permissionsForRole } from "@/lib/permissions";

const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimitKey(request: Request, email: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return `${ip}:${email}`;
}

function assertCanAttempt(key: string) {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < Date.now()) {
    attempts.set(key, { count: 0, resetAt: Date.now() + 5 * 60 * 1000 });
    return;
  }
  if (entry.count >= 8) {
    throw new AppError(429, "LOGIN_RATE_LIMIT", "Zu viele Login-Versuche. Bitte kurz warten.");
  }
}

function recordFailedAttempt(key: string) {
  const entry = attempts.get(key) ?? { count: 0, resetAt: Date.now() + 5 * 60 * 1000 };
  attempts.set(key, { ...entry, count: entry.count + 1 });
}

export function POST(request: Request) {
  return route(async () => {
    const input = await parseJson(request, loginSchema);
    const key = rateLimitKey(request, input.email);
    assertCanAttempt(key);

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { role: true },
    });

    const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!user || !valid || !user.active) {
      recordFailedAttempt(key);
      throw new AppError(401, "INVALID_CREDENTIALS", "E-Mail oder Passwort ist falsch.");
    }

    attempts.delete(key);
    await createSession(user.id);

    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.code,
        permissions: permissionsForRole(user.role.code),
      },
    });
  });
}
