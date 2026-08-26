-- ============================================================
--  MAXIM · QA/QC INSUMOS  ·  Alta de USUARIOS y asignación de ROL
--
--  Cada usuario (visor o editor) necesita DOS cosas:
--    (A) Una cuenta en Supabase → Authentication → Users → "Add user"
--        (correo + contraseña que TÚ defines).  Marca "Auto Confirm User".
--    (B) Una fila en public.perfiles con su ROL: 'visor' o 'editor'.
--
--  Este archivo hace la parte (B).  Repite el bloque por cada persona,
--  usando el MISMO correo con el que la creaste en el paso (A).
-- ============================================================

-- ---------- EJEMPLO: un EDITOR ----------
insert into public.perfiles (id, nombre, rol)
select id, 'Nombre del Editor', 'editor'
from auth.users where email = 'editor@ejemplo.com'
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;

-- ---------- EJEMPLO: un VISOR ----------
insert into public.perfiles (id, nombre, rol)
select id, 'Nombre del Visor', 'visor'
from auth.users where email = 'visor@ejemplo.com'
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;

-- ------------------------------------------------------------
--  COPIA Y RELLENA (uno por persona):
-- ------------------------------------------------------------
-- insert into public.perfiles (id, nombre, rol)
-- select id, 'NOMBRE COMPLETO', 'visor'   -- o 'editor'
-- from auth.users where email = 'CORREO@maxim.com'
-- on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;


-- ============================================================
--  ÚTILES
-- ============================================================
-- Ver todos los usuarios y su rol actual:
--   select u.email, p.nombre, p.rol
--   from auth.users u left join public.perfiles p on p.id = u.id
--   order by p.rol, u.email;

-- Cambiar el rol de alguien (de visor a editor o viceversa):
--   update public.perfiles set rol = 'editor'
--   where id = (select id from auth.users where email = 'CORREO@maxim.com');

-- Quitarle acceso a alguien: bórralo en Authentication → Users
--   (su fila en perfiles se elimina sola por el "on delete cascade").
