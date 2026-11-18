import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const sessionCookie = "mks_session";

function secret() {
  const value = process.env.MKS_SESSION_SECRET;
  if (!value) throw new Error("MKS_SESSION_SECRET tanımlı değil.");
  return value;
}

function signature(expires: string) {
  return createHmac("sha256", secret()).update(`mks:${expires}`).digest("hex");
}

export function createSessionToken(hours: number) {
  const expires = String(Date.now() + hours * 60 * 60 * 1000);
  return `${expires}.${signature(expires)}`;
}

export function verifySessionToken(token?: string) {
  if (!token) return false;
  const [expires, supplied] = token.split(".");
  if (!expires || !supplied || Number(expires) <= Date.now()) return false;
  const expected = signature(expires);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function isAuthenticated() {
  const store = await cookies();
  return verifySessionToken(store.get(sessionCookie)?.value);
}
