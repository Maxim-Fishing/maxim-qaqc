-- ============================================================
--  MAXIM · QA/QC INSUMOS  ·  Esquema de base de datos (Supabase / PostgreSQL)
--  Ejecutar en:  Supabase → SQL Editor → New query → pegar todo → Run
-- ============================================================

-- ---------- Tabla: equipos ----------
create table if not exists public.equipos (
    id                bigserial primary key,
    categoria         text not null default 'PCE',   -- 'HTA' (herramienta) | 'PCE' (equipo de presion)
    familia           text,                           -- ej. BOP, STANDING VALVE...
    nombre            text not null,                  -- nombre visible
    medida            text,                           -- ej. 3 1/2"
    fabricante        text,
    certificado       boolean not null default false, -- equipo certificado (sello verde)
    ficha_tecnica_url text,                           -- URL publica del PDF en Storage
    ficha_tecnica_nombre text,                        -- nombre del archivo PDF
    hoja_origen       text,                           -- hoja del Excel de origen (trazabilidad)
    created_at        timestamptz default now(),
    updated_at        timestamptz default now()
);

-- ---------- Tabla: consumibles ----------
create table if not exists public.consumibles (
    id          bigserial primary key,
    equipo_id   bigint not null references public.equipos(id) on delete cascade,
    grupo       text,          -- subseccion opcional (ej. BRAZO DE BOP, ECUALIZADOR)
    tipo        text not null, -- ej. ORING, BACKUP RING, VEE PACKING...
    cantidad    text,
    referencia  text,
    orden       int default 0,
    created_at  timestamptz default now()
);
create index if not exists idx_consumibles_equipo on public.consumibles(equipo_id);
create index if not exists idx_equipos_categoria on public.equipos(categoria);

-- ---------- Tabla: perfiles (rol de cada usuario autenticado) ----------
-- Los EDITORES se crean en Supabase → Authentication → Users (email + contraseña
-- que tu defines). Al crearlos, agrega aqui su rol = 'editor'.
create table if not exists public.perfiles (
    id      uuid primary key references auth.users(id) on delete cascade,
    nombre  text,
    rol     text not null default 'visor'   -- 'visor' | 'editor'  (por defecto: menor privilegio)
);

-- Funcion de ayuda: ¿el usuario actual es editor?
create or replace function public.es_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'editor');
$$;

-- ---------- updated_at automatico ----------
create or replace function public.set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_equipos_updated on public.equipos;
create trigger trg_equipos_updated before update on public.equipos
for each row execute function public.set_updated_at();

-- ============================================================
--  SEGURIDAD (Row Level Security)
--  Lectura: solo usuarios autenticados (visores y editores con login).
--  Escritura: solo editores (rol verificado en public.perfiles).
-- ============================================================
alter table public.equipos     enable row level security;
alter table public.consumibles enable row level security;
alter table public.perfiles    enable row level security;

-- Lectura solo autenticados
drop policy if exists "lectura publica equipos" on public.equipos;
drop policy if exists "lectura autenticada equipos" on public.equipos;
create policy "lectura autenticada equipos" on public.equipos
    for select using (auth.role() = 'authenticated');

drop policy if exists "lectura publica consumibles" on public.consumibles;
drop policy if exists "lectura autenticada consumibles" on public.consumibles;
create policy "lectura autenticada consumibles" on public.consumibles
    for select using (auth.role() = 'authenticated');

-- Escritura solo editores
drop policy if exists "escritura editores equipos" on public.equipos;
create policy "escritura editores equipos" on public.equipos
    for all using (public.es_editor()) with check (public.es_editor());

drop policy if exists "escritura editores consumibles" on public.consumibles;
create policy "escritura editores consumibles" on public.consumibles
    for all using (public.es_editor()) with check (public.es_editor());

-- Perfiles: cada quien lee/edita el suyo
drop policy if exists "perfil propio" on public.perfiles;
create policy "perfil propio" on public.perfiles
    for all using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================
--  STORAGE  ·  bucket 'fichas' para los PDF de fichas tecnicas
--  (Tambien puedes crearlo manualmente en Storage y marcarlo Public)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('fichas', 'fichas', true)
on conflict (id) do nothing;

drop policy if exists "fichas lectura publica" on storage.objects;
drop policy if exists "fichas lectura autenticada" on storage.objects;
create policy "fichas lectura autenticada" on storage.objects
    for select using (bucket_id = 'fichas' and auth.role() = 'authenticated');

drop policy if exists "fichas subida editores" on storage.objects;
create policy "fichas subida editores" on storage.objects
    for insert with check (bucket_id = 'fichas' and public.es_editor());

drop policy if exists "fichas update editores" on storage.objects;
create policy "fichas update editores" on storage.objects
    for update using (bucket_id = 'fichas' and public.es_editor());
