-- ============================================================
--  MAXIM · QA/QC INSUMOS  ·  PARCHE DE SEGURIDAD  (Parte A)
--  Ejecutar en:  Supabase → SQL Editor → New query → pegar todo → Run
--  Es SEGURO ejecutarlo varias veces. Hacerlo en el proyecto de QA/QC
--  (el de config.js), DESPUÉS de schema.sql y login-visores.sql.
--
--  Corrige:
--   1) ESCALADA DE PRIVILEGIOS: cualquier usuario podía editar su propia
--      fila de perfiles y ponerse rol='editor'.
--   2) Solicitudes: un visor podía crearlas ya "aprobadas", con
--      solicitante falso o con cargas enormes.
--   3) Storage: la política de UPDATE no validaba lo que se escribía.
-- ============================================================

-- ------------------------------------------------------------
-- 1) PERFILES: cada usuario SOLO PUEDE LEER el suyo.
--    Nadie desde la web puede insertar, editar ni borrar perfiles.
--    Los roles se asignan únicamente desde el SQL Editor
--    (ver db/usuarios-plantilla.sql).
-- ------------------------------------------------------------
drop policy if exists "perfil propio" on public.perfiles;
drop policy if exists "perfil propio lectura" on public.perfiles;
create policy "perfil propio lectura" on public.perfiles
    for select using (auth.uid() = id);

revoke insert, update, delete on public.perfiles from anon, authenticated;

-- ------------------------------------------------------------
-- 2) SOLICITUDES (solo si la tabla existe)
--    · Solo se pueden crear como 'pendiente', sin datos de resolución.
--    · Se registra quién la creó (solicitante_uid = usuario real).
--    · Se limita el tamaño de los JSON.
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.solicitudes') is not null then
    execute 'alter table public.solicitudes add column if not exists solicitante_uid uuid default auth.uid()';

    execute 'drop policy if exists "solicitudes insertar autenticados" on public.solicitudes';
    execute $p$
      create policy "solicitudes insertar autenticados" on public.solicitudes
      for insert with check (
            auth.role() = 'authenticated'
        and solicitante_uid = auth.uid()
        and estado = 'pendiente'
        and resuelto_por is null
        and resuelto_at  is null
        and tipo in ('editar_equipo','agregar_consumible','editar_consumible','eliminar_consumible')
        and coalesce(pg_column_size(propuesta), 0) < 2000
        and coalesce(pg_column_size(antes), 0)     < 2000
        and length(coalesce(solicitante, '')) < 120
      )
    $p$;

    -- Cada visor puede ver SUS solicitudes; los editores ven todas.
    execute 'drop policy if exists "solicitudes propias lectura" on public.solicitudes';
    execute 'create policy "solicitudes propias lectura" on public.solicitudes
             for select using (solicitante_uid = auth.uid())';
  end if;
end $$;

-- ------------------------------------------------------------
-- 3) STORAGE: update de fichas solo por editores y solo dentro del bucket
-- ------------------------------------------------------------
drop policy if exists "fichas update editores" on storage.objects;
create policy "fichas update editores" on storage.objects
    for update using (bucket_id = 'fichas' and public.es_editor())
    with check (bucket_id = 'fichas' and public.es_editor());

-- ------------------------------------------------------------
-- VERIFICACIÓN (opcional): debe listar SOLO 'perfil propio lectura'
--   select policyname, cmd from pg_policies where tablename = 'perfiles';
-- Y revisa que nadie tenga un rol que no debe:
--   select u.email, p.rol from auth.users u left join public.perfiles p on p.id = u.id order by p.rol;
-- ============================================================


-- ============================================================
--  PARTE B  ·  FICHAS PRIVADAS  (ejecutar SOLO DESPUÉS de publicar
--  la nueva versión de la web, que ya usa enlaces firmados)
--  Deja el bucket privado: los PDF ya no se abren sin iniciar sesión.
-- ============================================================
-- update storage.buckets set public = false where id = 'fichas';
