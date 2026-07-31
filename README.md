# MAXIM · QA/QC Insumos

Aplicación web para consultar y administrar los consumibles y fichas técnicas de las
herramientas (HTA) y equipos de presión (PCE) de Maxim.

Tres pantallas: **intro** (logo + video) → **login** (visualizador / editor) →
**interfaz** (filtros por categoría y fabricante, tabla de consumibles y visor de PDF).

---

## 1. Probarla YA (modo demo, sin instalar nada)

Abre `index.html` en el navegador. Funciona con los datos reales del Excel.
- **Visualizar:** escribe cualquier nombre.
- **Editar (demo):** usuario cualquiera + contraseña `demo` (para ver los botones de edición;
  en demo no guarda cambios ni sube archivos).

> El modo demo es solo para ver el diseño. Para guardar datos y subir fichas reales,
> conecta Supabase (paso 3).

---

## 2. Subir a GitHub (publicar la web gratis)

1. Crea un repositorio en GitHub (ej. `maxim-qaqc`).
2. Sube **todo el contenido de esta carpeta**.
3. En el repo: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
4. En 1–2 minutos tu web estará en `https://TU-USUARIO.github.io/maxim-qaqc/`.

---

## 3. Conectar Supabase (login real + base de datos + PDFs)

1. Crea una cuenta gratis en **https://supabase.com** y un proyecto nuevo.
2. Ve a **SQL Editor → New query**, pega el contenido de `db/schema.sql` y pulsa **Run**.
3. Nueva query: pega `db/seed.sql` y **Run** (carga los 50 equipos y sus consumibles).
4. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - la clave `anon public`
5. Pega esos dos valores en `assets/js/config.js`:
   ```js
   SUPABASE_URL: "https://xxxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJ....",
   ```
6. Sube el `config.js` actualizado a GitHub. Listo: la web ya usa la base de datos.

### Crear editores (los que pueden editar)
- **Authentication → Users → Add user** → escribe un correo y la **contraseña que tú definas**.
- En **SQL Editor** ejecuta (una vez por editor), usando el mismo correo:
  ```sql
  insert into public.perfiles (id, nombre, rol)
  select id, 'Nombre del editor', 'editor' from auth.users where email = 'correo@ejemplo.com';
  ```
- Ese editor ya podrá entrar en la pestaña **Editar** con su correo y contraseña.

> Los **visualizadores** no necesitan cuenta: solo escriben su nombre.

### Fichas técnicas (PDF)
El `schema.sql` crea un bucket público `fichas`. Cuando un editor abre un equipo y pulsa
**Subir PDF**, la ficha se guarda ahí y queda visible para todos en el visor.

---

## Estructura del proyecto

```
maxim-qaqc/
├── index.html            Intro (logo + video)
├── login.html            Login visualizador / editor
├── app.html              Interfaz principal
├── assets/
│   ├── css/styles.css
│   ├── js/config.js      ← aquí van tus credenciales de Supabase
│   ├── js/store.js       Capa de datos (Supabase o demo)
│   ├── js/app.js         Lógica de la interfaz
│   ├── js/data.js        Datos demo (generados del Excel)
│   ├── img/              logo.png, logo-blanco.png, poster.jpg  (ya incluidos)
│   └── video/            fondo.mp4              (ya incluido: Video A en loop)
├── data/                 equipos.json, consumibles.json, data.json
└── db/
    ├── schema.sql        Crea tablas + seguridad + storage
    ├── seed.sql          Carga los datos del Excel
    └── normalize.py      Script que generó los datos (referencia)
```

## Marca (ya integrada)
- **Logo:** `assets/img/logo-blanco.png` (versión clara para fondos oscuros, usada en intro,
  login y barra superior) y `assets/img/logo.png` (original, para fondos claros).
- **Video de fondo:** `assets/video/fondo.mp4` — el "Video A" (wireline al atardecer),
  recortado a un loop continuo de 9 s, sin audio y optimizado para web (~1 MB).
- **Póster:** `assets/img/poster.jpg` — fotograma que se ve mientras carga el video.
- **Color de marca:** el acento naranja está en `--acento` (`assets/css/styles.css`).
