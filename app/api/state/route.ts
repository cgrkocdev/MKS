import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SharedState = {
  revision: number;
  rows: unknown[];
  plans: unknown[];
  units: unknown[];
  updatedAt?: string;
};

function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL tanımlı değil.");
  return neon(connectionString);
}

async function ensureState() {
  const sql = database();
  await sql`
    CREATE TABLE IF NOT EXISTS mks_shared_state (
      id TEXT PRIMARY KEY,
      revision BIGINT NOT NULL DEFAULT 0,
      rows JSONB NOT NULL DEFAULT '[]'::jsonb,
      plans JSONB NOT NULL DEFAULT '[]'::jsonb,
      units JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    INSERT INTO mks_shared_state (id)
    VALUES ('main')
    ON CONFLICT (id) DO NOTHING
  `;
  return sql;
}

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

export async function GET() {
  try {
    const sql = await ensureState();
    const [state] = await sql`
      SELECT revision, rows, plans, units, updated_at
      FROM mks_shared_state
      WHERE id = 'main'
    `;
    return NextResponse.json(
      {
        revision: Number(state.revision),
        rows: state.rows,
        plans: state.plans,
        units: state.units,
        updatedAt: state.updated_at,
      } satisfies SharedState,
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Veritabanı okunamadı." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as Partial<SharedState>;
    if (!Number.isInteger(body.revision) || !Array.isArray(body.rows) || !Array.isArray(body.plans) || !Array.isArray(body.units)) {
      return NextResponse.json({ error: "Geçersiz ortak veri." }, { status: 400, headers: noStoreHeaders });
    }
    const sql = await ensureState();
    const [updated] = await sql`
      UPDATE mks_shared_state
      SET
        revision = revision + 1,
        rows = ${JSON.stringify(body.rows)}::jsonb,
        plans = ${JSON.stringify(body.plans)}::jsonb,
        units = ${JSON.stringify(body.units)}::jsonb,
        updated_at = NOW()
      WHERE id = 'main' AND revision = ${body.revision}
      RETURNING revision, updated_at
    `;
    if (!updated) {
      return NextResponse.json(
        { error: "Veri başka bir bilgisayarda güncellendi.", conflict: true },
        { status: 409, headers: noStoreHeaders },
      );
    }
    return NextResponse.json(
      { revision: Number(updated.revision), updatedAt: updated.updated_at },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Veritabanına yazılamadı." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
