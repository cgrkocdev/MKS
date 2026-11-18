import { NextResponse } from "next/server";
import { createSessionToken, isAuthenticated, sessionCookie } from "./session";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

export async function GET() {
  return NextResponse.json({ authenticated: await isAuthenticated() }, { headers: noStore });
}

export async function POST(request: Request) {
  const body = await request.json() as { username?: string; password?: string; remember?: boolean };
  const username = process.env.MKS_USERNAME ?? "admin";
  const password = process.env.MKS_PASSWORD ?? "MKS2026";
  if (body.username?.trim().toLowerCase() !== username.toLowerCase() || body.password !== password) {
    return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı." }, { status: 401, headers: noStore });
  }
  const remember = Boolean(body.remember);
  const response = NextResponse.json({ authenticated: true }, { headers: noStore });
  response.cookies.set(sessionCookie, createSessionToken(remember ? 24 * 30 : 12), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false }, { headers: noStore });
  response.cookies.set(sessionCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
