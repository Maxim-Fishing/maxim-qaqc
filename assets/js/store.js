// ============================================================
//  STORE  ·  Capa de datos. Habla con Supabase si esta configurado;
//  si no, usa los datos DEMO del Excel (window.DEMO_DATA).
// ============================================================
(function () {
  const cfg = window.APP_CONFIG || {};
  const DEMO = cfg.DEMO;
  let sb = null;

  if (!DEMO && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  // ---------- Sesion (guardada en el navegador) ----------
  const SESION_KEY = "maxim_sesion";
  function getSesion() {
    try { return JSON.parse(localStorage.getItem(SESION_KEY) || "null"); }
    catch (e) { return null; }
  }
  function setSesion(s) { localStorage.setItem(SESION_KEY, JSON.stringify(s)); }
  function limpiarSesion() { localStorage.removeItem(SESION_KEY); }

  // ---------- Autenticacion ----------
  // Login UNIFICADO: todos (visores y editores) entran con usuario/correo + contraseña.
  // El ROL se decide en la base de datos (tabla public.perfiles), NO en el navegador.
  // Si el usuario no tiene perfil, se asume el rol de menor privilegio: 'visor'.
  async function login(usuario, clave) {
    if (DEMO) {
      // Modo demo (sin Supabase): claves de prueba para ver la interfaz.
      //   clave "editor" -> entra como editor · clave "visor" -> entra como visor
      if (clave === "editor" || clave === "demo") {
        const s = { rol: "editor", nombre: usuario || "Editor (demo)", email: usuario };
        setSesion(s); return s;
      }
      if (clave === "visor") {
        const s = { rol: "visor", nombre: usuario || "Visor (demo)", email: usuario };
        setSesion(s); return s;
      }
      throw new Error('Modo demo: usa la clave "visor" o "editor" para probar.');
    }
    // Supabase acepta el correo como usuario
    const email = usuario.includes("@") ? usuario : `${usuario}`;
    const { data, error } = await sb.auth.signInWithPassword({ email, password: clave });
    if (error) throw new Error("Usuario o contraseña incorrectos.");
    // Leer el rol real del perfil (visor | editor)
    let rol = "visor", nombre = email;
    try {
      const { data: perfil } = await sb.from("perfiles")
        .select("rol,nombre").eq("id", data.user.id).maybeSingle();
      if (perfil) { rol = (perfil.rol || "visor").toLowerCase(); nombre = perfil.nombre || email; }
    } catch (e) { /* si no hay perfil, queda como visor */ }
    const s = { rol, nombre, email, uid: data.user.id };
    setSesion(s);
    return s;
  }

  // Compatibilidad: entrar como editor sigue funcionando llamando al login unificado.
  async function loginEditor(usuario, clave) { return login(usuario, clave); }

  // Confirma que la sesion de Supabase sigue viva y que el rol guardado es el real.
  // Devuelve la sesion actualizada, o null si hay que volver a iniciar sesion.
  async function revalidarSesion() {
    const actual = getSesion();
    if (!actual) return null;
    if (DEMO) return actual;
    if (!sb) return actual;
    const { data } = await sb.auth.getSession();
    if (!data || !data.session) { limpiarSesion(); return null; }
    try {
      const { data: perfil, error } = await sb.from("perfiles")
        .select("rol,nombre").eq("id", data.session.user.id).maybeSingle();
      if (!error) {
        actual.rol = perfil ? (perfil.rol || "visor").toLowerCase() : "visor";
        if (perfil && perfil.nombre) actual.nombre = perfil.nombre;
        setSesion(actual);
      }
    } catch (e) { /* si falla la consulta se conserva el rol guardado */ }
    return actual;
  }

  async function logout() {
    if (sb) { try { await sb.auth.signOut(); } catch (e) {} }
    limpiarSesion();
  }

  // ---------- Lectura de equipos / consumibles ----------
  async function getEquipos() {
    if (DEMO) {
      return (window.DEMO_DATA || []).map(e => ({ ...e }));
    }
    const { data: eq, error } = await sb.from("equipos").select("*").order("familia").order("nombre");
    if (error) throw error;
    const { data: co } = await sb.from("consumibles").select("*").order("orden");
    const byId = {};
    (co || []).forEach(c => { (byId[c.equipo_id] = byId[c.equipo_id] || []).push(c); });
    eq.forEach(e => {
      e.consumibles = byId[e.id] || [];
      e.ficha_tecnica = e.ficha_tecnica_nombre || "";
    });
    return eq;
  }

  // ---------- Edicion (solo editor / Supabase) ----------
  async function guardarEquipo(equipo) {
    if (DEMO) throw new Error("Modo demo: conecta Supabase para guardar cambios.");
    const payload = {
      categoria: equipo.categoria, familia: equipo.familia, nombre: equipo.nombre,
      medida: equipo.medida, fabricante: equipo.fabricante,
      certificado: !!equipo.certificado
    };
    if (equipo.id) {
      const { error } = await sb.from("equipos").update(payload).eq("id", equipo.id);
      if (error) throw error; return equipo.id;
    } else {
      const { data, error } = await sb.from("equipos").insert(payload).select("id").single();
      if (error) throw error; return data.id;
    }
  }

  async function borrarEquipo(id) {
    if (DEMO) throw new Error("Modo demo: conecta Supabase para eliminar.");
    const { error } = await sb.from("equipos").delete().eq("id", id);
    if (error) throw error;
  }

  async function guardarConsumible(c) {
    if (DEMO) throw new Error("Modo demo: conecta Supabase para guardar cambios.");
    const payload = { equipo_id: c.equipo_id, grupo: c.grupo || null, tipo: c.tipo, cantidad: c.cantidad, referencia: c.referencia };
    if (c.id) {
      const { error } = await sb.from("consumibles").update(payload).eq("id", c.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("consumibles").insert(payload);
      if (error) throw error;
    }
  }

  async function borrarConsumible(id) {
    if (DEMO) throw new Error("Modo demo: conecta Supabase para borrar.");
    const { error } = await sb.from("consumibles").delete().eq("id", id);
    if (error) throw error;
  }

  // ---------- Ficha tecnica (PDF en Storage) ----------
  // Se guarda la RUTA del archivo (no una URL publica). Para verlo se pide un enlace
  // firmado temporal, asi el bucket puede ser privado. Compatible con filas antiguas
  // que guardaron la URL publica completa.
  function rutaDeFicha(valor) {
    if (!valor) return "";
    const m = String(valor).match(/\/object\/(?:public|sign)\/[^/]+\/([^?]+)/);
    return m ? decodeURIComponent(m[1]) : String(valor);
  }
  async function urlFicha(valor) {
    if (!valor || DEMO || !sb) return "";
    const { data, error } = await sb.storage.from(cfg.BUCKET_FICHAS).createSignedUrl(rutaDeFicha(valor), 3600);
    if (error || !data) return "";
    return data.signedUrl;
  }
  async function subirFicha(equipoId, file) {
    if (DEMO) throw new Error("Modo demo: conecta Supabase para subir fichas.");
    if (file.type !== "application/pdf") throw new Error("El archivo debe ser PDF.");
    if (file.size > 25 * 1024 * 1024) throw new Error("El PDF supera 25 MB.");
    const limpio = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(-80) || "ficha.pdf";
    const ruta = `equipo-${Number(equipoId)}/${Date.now()}-${limpio}`;
    const { error: upErr } = await sb.storage.from(cfg.BUCKET_FICHAS).upload(ruta, file, { upsert: false, contentType: "application/pdf" });
    if (upErr) throw upErr;
    const { error } = await sb.from("equipos").update({ ficha_tecnica_url: ruta, ficha_tecnica_nombre: file.name }).eq("id", equipoId);
    if (error) throw error;
    return { url: ruta, nombre: file.name };
  }

  // ---------- Solicitudes de edicion (flujo de aprobacion) ----------
  async function crearSolicitud(sol) {
    if (DEMO) throw new Error("Modo demo: conecta Supabase.");
    const { error } = await sb.from("solicitudes").insert({
      tipo: sol.tipo,
      equipo_id: sol.equipo_id ?? null,
      consumible_id: sol.consumible_id ?? null,
      solicitante: sol.solicitante || "Anónimo",
      antes: sol.antes ?? null,
      propuesta: sol.propuesta ?? null,
      estado: "pendiente"
    });
    if (error) throw error;
  }

  async function getSolicitudes(estado) {
    if (DEMO) return [];
    let q = sb.from("solicitudes").select("*").order("creado_at", { ascending: true });
    if (estado) q = q.eq("estado", estado);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  // Solo estos campos pueden cambiarse por una solicitud (el JSON lo envia un visor).
  const CAMPOS_EQUIPO = ["categoria", "familia", "nombre", "medida", "fabricante"];
  const CAMPOS_CONS = ["grupo", "tipo", "cantidad", "referencia"];
  function soloCampos(obj, permitidos) {
    const out = {};
    permitidos.forEach(k => { if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k]; });
    return out;
  }

  async function resolverSolicitud(sol, aprobar, editor) {
    if (DEMO) throw new Error("Modo demo.");
    if (aprobar) {
      if (sol.tipo === "editar_equipo") {
        const { error } = await sb.from("equipos").update(soloCampos(sol.propuesta, CAMPOS_EQUIPO)).eq("id", sol.equipo_id);
        if (error) throw error;
      } else if (sol.tipo === "agregar_consumible") {
        const { error } = await sb.from("consumibles").insert({ ...soloCampos(sol.propuesta, CAMPOS_CONS), equipo_id: sol.equipo_id });
        if (error) throw error;
      } else if (sol.tipo === "editar_consumible") {
        const { error } = await sb.from("consumibles").update(soloCampos(sol.propuesta, CAMPOS_CONS)).eq("id", sol.consumible_id);
        if (error) throw error;
      } else if (sol.tipo === "eliminar_consumible") {
        const { error } = await sb.from("consumibles").delete().eq("id", sol.consumible_id);
        if (error) throw error;
      }
    }
    const { error } = await sb.from("solicitudes").update({
      estado: aprobar ? "aprobada" : "rechazada",
      resuelto_por: editor || null,
      resuelto_at: new Date().toISOString()
    }).eq("id", sol.id);
    if (error) throw error;
  }

  window.Store = {
    DEMO, getSesion, setSesion, limpiarSesion,
    login, loginEditor, logout,
    revalidarSesion, urlFicha, getEquipos, guardarEquipo, borrarEquipo, guardarConsumible, borrarConsumible, subirFicha,
    crearSolicitud, getSolicitudes, resolverSolicitud
  };
})();
