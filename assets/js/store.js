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
  async function loginVisor(nombre) {
    const s = { rol: "visor", nombre: (nombre || "Invitado").trim() };
    setSesion(s);
    return s;
  }

  async function loginEditor(usuario, clave) {
    if (DEMO) {
      // Modo demo: clave universal para probar la interfaz de edicion
      if (clave === "demo") {
        const s = { rol: "editor", nombre: usuario || "Editor (demo)", email: usuario };
        setSesion(s);
        return s;
      }
      throw new Error('Modo demo: usa la clave "demo" para probar el editor.');
    }
    // Supabase acepta email como usuario
    const email = usuario.includes("@") ? usuario : `${usuario}`;
    const { data, error } = await sb.auth.signInWithPassword({ email, password: clave });
    if (error) throw new Error("Usuario o contraseña incorrectos.");
    const s = { rol: "editor", nombre: email, email, uid: data.user.id };
    setSesion(s);
    return s;
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
      medida: equipo.medida, fabricante: equipo.fabricante
    };
    if (equipo.id) {
      const { error } = await sb.from("equipos").update(payload).eq("id", equipo.id);
      if (error) throw error; return equipo.id;
    } else {
      const { data, error } = await sb.from("equipos").insert(payload).select("id").single();
      if (error) throw error; return data.id;
    }
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

  // ---------- Ficha tecnica (subir PDF a Storage) ----------
  async function subirFicha(equipoId, file) {
    if (DEMO) throw new Error("Modo demo: conecta Supabase para subir fichas.");
    const ruta = `equipo-${equipoId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await sb.storage.from(cfg.BUCKET_FICHAS).upload(ruta, file, { upsert: true, contentType: "application/pdf" });
    if (upErr) throw upErr;
    const { data } = sb.storage.from(cfg.BUCKET_FICHAS).getPublicUrl(ruta);
    const url = data.publicUrl;
    const { error } = await sb.from("equipos").update({ ficha_tecnica_url: url, ficha_tecnica_nombre: file.name }).eq("id", equipoId);
    if (error) throw error;
    return { url, nombre: file.name };
  }

  window.Store = {
    DEMO, getSesion, setSesion, limpiarSesion,
    loginVisor, loginEditor, logout,
    getEquipos, guardarEquipo, guardarConsumible, borrarConsumible, subirFicha
  };
})();
