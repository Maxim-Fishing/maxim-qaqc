-- ============================================================
--  MAXIM · QA/QC INSUMOS  ·  Migración: LOGIN OBLIGATORIO PARA VISORES
--  Ejecutar en:  Supabase → SQL Editor → New query → pegar todo → Run
--
--  Qué hace:
--   1) La lectura de la información deja de ser pública: solo usuarios
--      autenticados (visores O editores que iniciaron sesión) pueden leer.
--   2) La escritura (crear/editar/borrar) queda restringida SOLO a editores,
--      verificando el rol en la tabla public.perfiles (no basta con estar logueado).
--   3) Cubre también el flujo de solicitudes (si la tabla existe).
--
--  Requisito previo: haber ejecutado schema.sql alguna vez (tablas ya creadas).
--  Es SEGURO ejecutarla varias veces (usa drop policy if exists).
-- ============================================================

-- ------------------------------------------------------------
-- 0) Rol por defecto de un perfil = 'visor' (menor privilegio).
--    Antes era 'editor'; así, si te olvidas de asignar rol, la persona
--    entra como visor y no como editor.
-- ------------------------------------------------------------
alter table public.perfiles alter column rol set default 'visor';

-- ------------------------------------------------------------
-- 1) Función de ayuda: ¿el usuario actual es editor?
--    SECURITY DEFINER para poder leer perfiles sin chocar con RLS.
-- ------------------------------------------------------------
create or replace function public.es_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.rol = 'editor'
  );
$$;

-- ============================================================
--  2) EQUIPOS
-- ============================================================
-- Quitar la lectura pública anterior
drop policy if exists "lectura publica equipos" on public.equipos;
-- Lectura solo para usuarios autenticados (visores y editores)
drop policy if exists "lectura autenticada equipos" on public.equipos;
create policy "lectura autenticada equipos" on public.equipos
    for select using (auth.role() = 'authenticated');

-- Escritura solo editores (verificado por rol en perfiles)
drop policy if exists "escritura editores equipos" on public.equipos;
create policy "escritura editores equipos" on public.equipos
    for all using (public.es_editor()) with check (public.es_editor());

-- ============================================================
--  3) CONSUMIBLES
-- ============================================================
drop policy if exists "lectura publica consumibles" on public.consumibles;
drop policy if exists "lectura autenticada consumibles" on public.consumibles;
create policy "lectura autenticada consumibles" on public.consumibles
    for select using (auth.role() = 'authenticated');

drop policy if exists "escritura editores consumibles" on public.consumibles;
create policy "escritura editores consumibles" on public.consumibles
    for all using (public.es_editor()) with check (public.es_editor());

-- ============================================================
--  4) STORAGE (fichas técnicas PDF)
--     Lectura de PDFs: solo autenticados.  Subir/actualizar: solo editores.
-- ============================================================
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

-- Nota: si quieres que las fichas dejen de ser accesibles por URL directa a
-- cualquiera, marca el bucket 'fichas' como PRIVADO en Supabase → Storage.
-- (Con bucket público, el PDF sigue siendo abrible por su URL aunque no haya login.)

-- ============================================================
--  5) SOLICITUDES (flujo de aprobación) — solo si la tabla existe
--     · Insertar (pedir un cambio): cualquier usuario autenticado (visores).
--     · Ver / resolver (aprobar-rechazar): solo editores.
-- ============================================================
do $$
begin
  if to_regclass('public.solicitudes') is not null then
    execute 'alter table public.solicitudes enable row level security';

    execute 'drop policy if exists "solicitudes insertar autenticados" on public.solicitudes';
    execute 'create policy "solicitudes insertar autenticados" on public.solicitudes
             for insert with check (auth.role() = ''authenticated'')';

    execute 'drop policy if exists "solicitudes ver editores" on public.solicitudes';
    execute 'create policy "solicitudes ver editores" on public.solicitudes
             for select using (public.es_editor())';

    execute 'drop policy if exists "solicitudes resolver editores" on public.solicitudes';
    execute 'create policy "solicitudes resolver editores" on public.solicitudes
             for update using (public.es_editor()) with check (public.es_editor())';
  end if;
end $$;

-- ============================================================
--  LISTO. A partir de aquí, nadie ve la información sin iniciar sesión.
--  Para dar de alta usuarios, usa el archivo:  db/usuarios-plantilla.sql
-- ============================================================
