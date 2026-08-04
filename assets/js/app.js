// ============================================================
//  APP  ·  Interfaz principal MAXIM QA/QC
// ============================================================
let EQUIPOS = [];
let filtro = { cat: "", fab: "", texto: "" };
let seleccionado = null;
let editandoConsumible = null;
let SESION = null, ROL = "visor";

const $ = (id) => document.getElementById(id);

// ---------- Arranque ----------
(async function init() {
  const s = Store.getSesion();
  if (!s) { location.href = "login.html"; return; }
  SESION = s; ROL = s.rol;

  $("nombre-user").textContent = s.nombre;
  const pill = $("rol-pill");
  if (s.rol === "editor") {
    pill.textContent = "EDITOR"; pill.className = "pill editor";
    document.body.classList.add("rol-editor");
  } else {
    pill.textContent = "VISOR"; pill.className = "pill visor";
    document.body.classList.add("rol-visor");
  }
  if (Store.DEMO) $("demo-pill").style.display = "inline-block";

  // filtros por categoria
  document.querySelectorAll("#seg-cat button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll("#seg-cat button").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); filtro.cat = b.dataset.cat;
      poblarFabricantes(); render();
    };
  });
  $("filtro-fab").onchange = (e) => { filtro.fab = e.target.value; render(); };
  $("buscar").oninput = (e) => { filtro.texto = e.target.value.toLowerCase(); render(); };

  await cargar();
  if (ROL === "editor") cargarConteoSolicitudes();
})();

async function cargar() {
  try {
    EQUIPOS = await Store.getEquipos();
    poblarFabricantes();
    render();
  } catch (e) {
    toast("Error cargando datos: " + (e.message || e), false);
  }
}

// Rellena el desplegable de fabricantes SOLO con los de la categoria activa
function poblarFabricantes() {
  const sel = $("filtro-fab");
  const base = EQUIPOS.filter(e => !filtro.cat || e.categoria === filtro.cat);
  const fabs = [...new Set(base.map(e => e.fabricante).filter(Boolean))].sort();
  // si el fabricante elegido ya no aplica a la categoria, se limpia
  if (filtro.fab && !fabs.includes(filtro.fab)) filtro.fab = "";
  sel.innerHTML = '<option value="">Todos los fabricantes</option>' +
    fabs.map(f => `<option value="${esc(f)}" ${f === filtro.fab ? "selected" : ""}>${esc(f)}</option>`).join("");
}

// ---------- Render lista ----------
function render() {
  const lista = $("lista");
  const items = EQUIPOS.filter(e => {
    if (filtro.cat && e.categoria !== filtro.cat) return false;
    if (filtro.fab && e.fabricante !== filtro.fab) return false;
    if (filtro.texto) {
      const hay = `${e.nombre} ${e.familia} ${e.medida} ${e.fabricante}`.toLowerCase();
      if (!hay.includes(filtro.texto)) return false;
    }
    return true;
  });

  if (!items.length) { lista.innerHTML = `<p style="color:var(--texto-tenue);font-size:.85rem;padding:.5rem">Sin resultados.</p>`; return; }

  lista.innerHTML = items.map(e => `
    <button class="item ${seleccionado && seleccionado.id === e.id ? "sel" : ""}" onclick="seleccionar(${e.id})">
      <span class="n">${esc(e.nombre)}</span>
      <span class="m">
        <span class="tag-cat ${e.categoria}">${e.categoria}</span>
        ${e.certificado ? `<span class="tag-cert">CERTIFICADO</span>` : ""}
        ${e.medida ? `<span>${esc(e.medida)}</span>` : ""}
        ${e.fabricante ? `<span>· ${esc(e.fabricante)}</span>` : ""}
        ${e.ficha_tecnica || e.ficha_tecnica_url ? `<span title="Tiene ficha">📄</span>` : ""}
      </span>
    </button>`).join("");
}

// ---------- Seleccion / detalle ----------
function seleccionar(id) {
  seleccionado = EQUIPOS.find(e => e.id === id);
  render();
  $("vacio").style.display = "none";
  $("detalle").style.display = "block";
  if (window.innerWidth <= 820) { $("sidebar").classList.add("oculto"); $("main").classList.remove("oculto"); }

  $("d-nombre").textContent = seleccionado.nombre;
  $("d-meta").innerHTML = [
    seleccionado.certificado ? `<span class="chip chip-cert">✓ CERTIFICADO</span>` : "",
    `<span class="chip">${seleccionado.categoria === "HTA" ? "Herramienta" : "Equipo de presión"}</span>`,
    seleccionado.familia ? `<span class="chip">${esc(seleccionado.familia)}</span>` : "",
    seleccionado.medida ? `<span class="chip">${esc(seleccionado.medida)}</span>` : "",
    seleccionado.fabricante ? `<span class="chip">Fab: ${esc(seleccionado.fabricante)}</span>` : ""
  ].join("");

  renderTabla();
  renderFicha();
}

function renderTabla() {
  const tb = $("d-tabla");
  const cons = seleccionado.consumibles || [];
  if (!cons.length) { tb.innerHTML = `<tr><td colspan="4" style="color:var(--texto-tenue)">Sin consumibles registrados.</td></tr>`; return; }
  let grupoPrev = null, html = "";
  cons.forEach(c => {
    if (c.grupo && c.grupo !== grupoPrev) {
      grupoPrev = c.grupo;
      html += `<tr class="grupo-row"><td colspan="4">${esc(c.grupo)}</td></tr>`;
    }
    html += `<tr>
      <td>${esc(c.tipo)}</td>
      <td>${esc(c.cantidad || "")}</td>
      <td>${esc(c.referencia || "")}</td>
      <td>
        <button class="btn ghost mini" onclick='abrirModalConsumible(${JSON.stringify(c).replace(/'/g, "&#39;")})'>✎</button>
      </td>
    </tr>`;
  });
  tb.innerHTML = html;
}

function renderFicha() {
  const cont = $("ficha-cont");
  const url = seleccionado.ficha_tecnica_url;
  const nombre = seleccionado.ficha_tecnica_nombre || seleccionado.ficha_tecnica || "";
  $("ficha-nombre").textContent = nombre ? nombre : "";
  $("ficha-btn-txt").textContent = url ? "Reemplazar PDF" : "Subir PDF";

  if (url) {
    $("ficha-abrir").style.display = "inline-flex";
    $("ficha-abrir").href = url;
    cont.innerHTML = `<iframe class="ficha-visor" src="${esc(url)}#toolbar=1&view=FitH"></iframe>`;
  } else {
    $("ficha-abrir").style.display = "none";
    const aviso = nombre
      ? `Ficha referenciada en el Excel: <b>${esc(nombre)}</b>.<br>Sube el PDF para poder visualizarlo aquí.`
      : "No hay ficha técnica cargada para este equipo.";
    cont.innerHTML = `<div class="ficha-none">${aviso}${Store.DEMO ? "<br><small>(En modo demo no se pueden subir archivos.)</small>" : ""}</div>`;
  }
}

function volverLista() {
  $("sidebar").classList.remove("oculto"); $("main").classList.add("oculto");
}

// ---------- Edicion: equipo ----------
function abrirModalEquipo(editar) {
  const e = editar ? seleccionado : { categoria: "PCE", familia: "", nombre: "", medida: "", fabricante: "" };
  const esEd = ROL === "editor";
  $("modal-equipo-titulo").textContent = esEd ? (editar ? "Editar equipo" : "Nuevo equipo") : "Solicitar cambios del equipo";
  $("btn-guardar-equipo").textContent = esEd ? "Guardar" : "Solicitar edición";
  $("e-categoria").value = e.categoria || "PCE";
  $("e-familia").value = e.familia || "";
  $("e-nombre").value = e.nombre || "";
  $("e-medida").value = e.medida || "";
  $("e-fabricante").value = e.fabricante || "";
  $("e-certificado").checked = !!(editar && e.certificado);
  $("e-borrar").style.display = (editar && esEd) ? "inline-flex" : "none";
  $("modal-equipo").dataset.id = editar ? e.id : "";
  abrir("modal-equipo");
}

async function borrarEquipo() {
  const id = $("modal-equipo").dataset.id;
  if (!id) return;
  const nombre = seleccionado ? seleccionado.nombre : "este equipo";
  if (!confirm(`¿Eliminar "${nombre}" y todos sus consumibles?\nEsta acción no se puede deshacer.`)) return;
  try {
    await Store.borrarEquipo(Number(id));
    cerrar("modal-equipo");
    toast("Equipo eliminado.", true);
    seleccionado = null;
    $("detalle").style.display = "none";
    $("vacio").style.display = "grid";
    await cargar();  // recarga lista y depura el desplegable de fabricantes
  } catch (e) { toast(e.message, false); }
}
async function guardarEquipo() {
  const id = $("modal-equipo").dataset.id;
  const eq = {
    id: id ? Number(id) : null,
    categoria: $("e-categoria").value, familia: $("e-familia").value.trim(),
    nombre: $("e-nombre").value.trim(), medida: $("e-medida").value.trim(),
    fabricante: $("e-fabricante").value.trim(),
    certificado: $("e-certificado").checked
  };
  if (!eq.nombre) { toast("El nombre es obligatorio.", false); return; }
  try {
    if (ROL === "editor") {
      const nuevoId = await Store.guardarEquipo(eq);
      cerrar("modal-equipo");
      toast("Equipo guardado.", true);
      await cargar();
      seleccionar(eq.id || nuevoId);
    } else {
      const antes = seleccionado ? { categoria: seleccionado.categoria, familia: seleccionado.familia, nombre: seleccionado.nombre, medida: seleccionado.medida, fabricante: seleccionado.fabricante } : null;
      const propuesta = { categoria: eq.categoria, familia: eq.familia, nombre: eq.nombre, medida: eq.medida, fabricante: eq.fabricante };
      await Store.crearSolicitud({ tipo: "editar_equipo", equipo_id: eq.id, solicitante: SESION.nombre, antes, propuesta });
      cerrar("modal-equipo");
      toast("Solicitud enviada. Un editor la revisará.", true);
    }
  } catch (e) { toast(e.message, false); }
}

// ---------- Edicion: consumible ----------
function abrirModalConsumible(c) {
  editandoConsumible = c || null;
  const esEd = ROL === "editor";
  $("modal-cons-titulo").textContent = esEd ? (c ? "Editar consumible" : "Nuevo consumible") : (c ? "Solicitar cambio de consumible" : "Solicitar nuevo consumible");
  $("btn-guardar-cons").textContent = esEd ? "Guardar" : "Solicitar edición";
  $("c-borrar").textContent = esEd ? "Borrar" : "Solicitar quitar";
  $("c-grupo").value = c ? (c.grupo || "") : "";
  $("c-tipo").value = c ? c.tipo : "";
  $("c-cantidad").value = c ? (c.cantidad || "") : "";
  $("c-referencia").value = c ? (c.referencia || "") : "";
  $("c-borrar").style.display = c && c.id ? "inline-flex" : "none";
  abrir("modal-consumible");
}
async function guardarConsumible() {
  const c = {
    id: editandoConsumible ? editandoConsumible.id : null,
    equipo_id: seleccionado.id,
    grupo: $("c-grupo").value.trim(), tipo: $("c-tipo").value.trim(),
    cantidad: $("c-cantidad").value.trim(), referencia: $("c-referencia").value.trim()
  };
  if (!c.tipo) { toast("El tipo es obligatorio.", false); return; }
  try {
    if (ROL === "editor") {
      await Store.guardarConsumible(c);
      cerrar("modal-consumible");
      toast("Consumible guardado.", true);
      await cargar(); seleccionar(seleccionado.id);
    } else {
      const prop = { tipo: c.tipo, cantidad: c.cantidad, referencia: c.referencia, grupo: c.grupo || null };
      if (c.id) {
        const a = editandoConsumible;
        await Store.crearSolicitud({ tipo: "editar_consumible", equipo_id: seleccionado.id, consumible_id: c.id, solicitante: SESION.nombre, antes: { tipo: a.tipo, cantidad: a.cantidad, referencia: a.referencia }, propuesta: prop });
      } else {
        await Store.crearSolicitud({ tipo: "agregar_consumible", equipo_id: seleccionado.id, solicitante: SESION.nombre, propuesta: prop });
      }
      cerrar("modal-consumible");
      toast("Solicitud enviada. Un editor la revisará.", true);
    }
  } catch (e) { toast(e.message, false); }
}
async function borrarConsumible() {
  if (!editandoConsumible || !editandoConsumible.id) return;
  try {
    if (ROL === "editor") {
      if (!confirm("¿Borrar este consumible?")) return;
      await Store.borrarConsumible(editandoConsumible.id);
      cerrar("modal-consumible");
      toast("Consumible borrado.", true);
      await cargar(); seleccionar(seleccionado.id);
    } else {
      const a = editandoConsumible;
      await Store.crearSolicitud({ tipo: "eliminar_consumible", equipo_id: seleccionado.id, consumible_id: a.id, solicitante: SESION.nombre, antes: { tipo: a.tipo, cantidad: a.cantidad, referencia: a.referencia } });
      cerrar("modal-consumible");
      toast("Solicitud enviada. Un editor la revisará.", true);
    }
  } catch (e) { toast(e.message, false); }
}

// ---------- Solicitudes de edicion (aprobacion) ----------
async function cargarConteoSolicitudes() {
  try {
    const pend = await Store.getSolicitudes("pendiente");
    window._solpend = pend;
    const b = $("sol-count");
    b.textContent = pend.length;
    b.style.display = pend.length ? "inline-block" : "none";
  } catch (e) { /* silencioso */ }
}
async function abrirSolicitudes() {
  await cargarConteoSolicitudes();
  renderSolicitudes(window._solpend || []);
  abrir("modal-solicitudes");
}
function nombreEquipo(id) { const e = EQUIPOS.find(x => x.id === id); return e ? e.nombre : ("#" + id); }
function describirSolicitud(s) {
  const p = s.propuesta || {}, a = s.antes || {};
  if (s.tipo === "editar_equipo") {
    const campos = ["nombre", "categoria", "fabricante", "medida", "familia"];
    const filas = campos.filter(k => (a[k] || "") !== (p[k] || "")).map(k =>
      `<div class="dl"><span class="k">${k}:</span> <span class="old">${esc(a[k] || "—")}</span> → <span class="new">${esc(p[k] || "—")}</span></div>`).join("");
    return `<b>Editar equipo</b> · ${esc(nombreEquipo(s.equipo_id))}${filas || "<div class='dl'>(sin cambios)</div>"}`;
  }
  if (s.tipo === "agregar_consumible")
    return `<b>Agregar consumible</b> · ${esc(nombreEquipo(s.equipo_id))}<div class="dl"><span class="new">${esc(p.tipo)} · cant ${esc(p.cantidad || "")} · ref ${esc(p.referencia || "")}</span></div>`;
  if (s.tipo === "editar_consumible")
    return `<b>Editar consumible</b> · ${esc(nombreEquipo(s.equipo_id))}<div class="dl"><span class="old">${esc(a.tipo)} · ${esc(a.cantidad || "")} · ${esc(a.referencia || "")}</span> → <span class="new">${esc(p.tipo)} · ${esc(p.cantidad || "")} · ${esc(p.referencia || "")}</span></div>`;
  if (s.tipo === "eliminar_consumible")
    return `<b>Quitar consumible</b> · ${esc(nombreEquipo(s.equipo_id))}<div class="dl"><span class="old">${esc(a.tipo)} · ${esc(a.cantidad || "")} · ${esc(a.referencia || "")}</span></div>`;
  return esc(s.tipo);
}
function renderSolicitudes(list) {
  const cont = $("sol-lista");
  if (!list.length) { cont.innerHTML = `<p style="color:var(--texto-tenue)">No hay solicitudes pendientes.</p>`; return; }
  cont.innerHTML = list.map(s => `
    <div class="sol-item">
      <div class="who">Solicitado por <b>${esc(s.solicitante)}</b></div>
      <div class="diff">${describirSolicitud(s)}</div>
      <div class="sol-acc">
        <button class="btn ok mini" onclick="resolver(${s.id}, true)">Aprobar</button>
        <button class="btn danger mini" onclick="resolver(${s.id}, false)">Rechazar</button>
      </div>
    </div>`).join("");
}
async function resolver(id, aprobar) {
  const s = (window._solpend || []).find(x => x.id === id); if (!s) return;
  try {
    await Store.resolverSolicitud(s, aprobar, SESION.email || SESION.nombre);
    toast(aprobar ? "Solicitud aprobada." : "Solicitud rechazada.", true);
    await cargar();
    await cargarConteoSolicitudes();
    renderSolicitudes(window._solpend || []);
    if (seleccionado && EQUIPOS.find(e => e.id === seleccionado.id)) seleccionar(seleccionado.id);
  } catch (e) { toast(e.message, false); }
}

// ---------- Ficha ----------
async function subirFicha(input) {
  const file = input.files[0]; if (!file) return;
  if (file.type !== "application/pdf") { toast("El archivo debe ser PDF.", false); return; }
  toast("Subiendo ficha…", true);
  try {
    const r = await Store.subirFicha(seleccionado.id, file);
    seleccionado.ficha_tecnica_url = r.url;
    seleccionado.ficha_tecnica_nombre = r.nombre;
    renderFicha(); toast("Ficha técnica subida.", true);
    await cargar();
  } catch (e) { toast(e.message, false); }
  input.value = "";
}

// ---------- Utilidades ----------
function abrir(id) { $(id).classList.add("abierto"); }
function cerrar(id) { $(id).classList.remove("abierto"); }
function salir() { Store.logout().finally(() => location.href = "login.html"); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m])); }
let toastT;
function toast(txt, ok) {
  const t = $("toast"); t.textContent = txt; t.className = "toast " + (ok ? "ok" : "err");
  t.style.display = "block"; clearTimeout(toastT);
  toastT = setTimeout(() => t.style.display = "none", 3000);
}
