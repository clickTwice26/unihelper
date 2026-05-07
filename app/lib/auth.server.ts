import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { createCookie, redirect } from "react-router";

import { db } from "~/lib/db.server";
import { env } from "~/lib/env.server";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const sessionCookie = createCookie("unihelper_session", {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: env.NODE_ENV === "production",
  secrets: [env.SESSION_SECRET],
  maxAge: SESSION_TTL_MS / 1000,
});

type SafeUser = {
  id: string;
  email: string;
  displayName: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toSafeUser(user: SafeUser): SafeUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}

async function createSessionRecord(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

async function destroySessionByToken(token: string | null) {
  if (!token) {
    return;
  }

  await db.session.deleteMany({
    where: { token },
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(storedHash, "hex");

  if (derivedKey.length !== storedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedKey);
}

export async function getSessionToken(request: Request) {
  return (await sessionCookie.parse(request.headers.get("Cookie"))) ?? null;
}

export async function getAuthenticatedUser(request: Request) {
  const token = await getSessionToken(request);

  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await destroySessionByToken(token);
    return null;
  }

  return toSafeUser(session.user);
}

export async function createUserSession(userId: string, redirectTo: string, flashMessage?: string) {
  const { token, expiresAt } = await createSessionRecord(userId);

  const headers = new Headers();
  headers.append("Set-Cookie", await sessionCookie.serialize(token, { expires: expiresAt }));

  if (flashMessage) {
    const { serializeFlash } = await import("~/lib/flash.server");
    headers.append("Set-Cookie", await serializeFlash(flashMessage));
  }

  throw redirect(redirectTo, { headers });
}

export async function destroyUserSession(request: Request, redirectTo: string) {
  const token = await getSessionToken(request);
  await destroySessionByToken(token);

  throw redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionCookie.serialize("", { maxAge: 0 }),
    },
  });
}

export async function redirectIfAuthenticated(request: Request, redirectTo = "/") {
  const user = await getAuthenticatedUser(request);

  if (user) {
    throw redirect(redirectTo);
  }
}

export async function findUserByEmail(email: string) {
  return db.user.findUnique({
    where: {
      email: normalizeEmail(email),
    },
  });
}

export async function registerUser(input: {
  email: string;
  displayName: string;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);

  return db.user.create({
    data: {
      email: normalizeEmail(input.email),
      displayName: input.displayName.trim(),
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  });
}

export function isValidPassword(password: string) {
  return password.length >= 8;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export async function getUserById(id: string) {
  return db.user.findUnique({
    where: { id },
    select: { id: true, email: true, displayName: true, passwordHash: true, createdAt: true },
  });
}

export async function updateUserProfile(
  id: string,
  input: { displayName: string; email: string },
) {
  const email = normalizeEmail(input.email);

  const conflict = await db.user.findFirst({
    where: { email, NOT: { id } },
    select: { id: true },
  });

  if (conflict) {
    throw new Error("EMAIL_TAKEN");
  }

  return db.user.update({
    where: { id },
    data: { email, displayName: input.displayName.trim() || null },
    select: { id: true, email: true, displayName: true },
  });
}

export async function updateUserPassword(
  id: string,
  input: { currentPassword: string; newPassword: string },
) {
  const user = await db.user.findUnique({
    where: { id },
    select: { passwordHash: true },
  });

  if (!user) throw new Error("NOT_FOUND");

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) throw new Error("WRONG_PASSWORD");

  const passwordHash = await hashPassword(input.newPassword);
  await db.user.update({ where: { id }, data: { passwordHash } });
}