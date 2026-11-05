// Postgres embarqué (PGlite) avec un faux schéma "auth" qui imite Supabase
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

export const SQL_FILES = ['../supabase/schema.sql', '../supabase/seed.sql', '../supabase/migrations/002_lot2.sql', '../supabase/migrations/004_lot3.sql', '../supabase/migrations/005_widget.sql', '../supabase/migrations/006_progression.sql', '../supabase/migrations/007_visitors.sql']

const AUTH_STUB = `
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  end $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`

export async function createDb(files = SQL_FILES) {
  const db = new PGlite()
  await db.exec(AUTH_STUB)
  for (const f of files) await db.exec(read(f))

  async function as<T>(user: string, sql: string, params: unknown[] = []): Promise<T[]> {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`)
    try {
      return (await db.query<T>(sql, params)).rows
    } finally {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
    }
  }

  async function admin<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    await db.exec(`reset role;`)
    return (await db.query<T>(sql, params)).rows
  }

  async function xpOf(user: string): Promise<number> {
    const rows = await admin<{ xp: number }>(`select coalesce(sum(amount), 0)::int as xp from public.xp_events where profile_id = $1`, [user])
    return rows[0].xp
  }

  async function today(): Promise<string> {
    return (await admin<{ d: string }>(`select public.today_paris()::text as d`))[0].d
  }

  return { db, as, admin, xpOf, today }
}

export const VAL = '00000000-0000-0000-0000-00000000000a'
export const JULIE = '00000000-0000-0000-0000-00000000000b'
export const OTHER = '00000000-0000-0000-0000-00000000000c'
export const INTRUDER = '00000000-0000-0000-0000-00000000000d'
