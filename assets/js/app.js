// ============================================================
//  APP  ·  Interfaz principal MAXIM QA/QC
// ============================================================
let EQUIPOS = [];
let filtro = { cat: "", fab: "", texto: "" };
let seleccionado = null;
let editandoConsumible = null;

const $ = (id) => document.getElementById(id);

// ---------- Arranque ----------
(async function init() {
  const s = Store.getSesion();
  if (!s) { location.href = "login.html"; return; }

  $("nombre-user").textContent = s.nombre;
  const pill = $("rol-pill");
  if (s.rol === "editor") {
    pill.textContent = "EDITOR"; pill.className = "pill editor";
    document.body.classList.add("rol-editor");
  } else {
    pill.textContent = "VISOR"; pill.className = "pill visor";
  }
  if (Store.DEMO) $("demo-pill").style.display = "inline-block";

  // filtros por categoria
  document.querySelectorAll("#seg-cat button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll("#seg-cat button").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); filtro.cat = b.dataset.cat; render();
    };
  });
  $("filtro-fab").onchange = (e) => { filtro.fab = e.target.value; render(); };
  $("buscar").oninput = (e) => { filtro.texto = e.target.value.toLowerCase(); render(); };

  await cargar();
})();

async function cargar() {
  try {
    EQUIPOS = await Store.getEquipos();
    // poblar fabricantes
    const fabs = [...new Set(EQUIPOS.map(e => e.fabricante).filter(Boolean))].sort();
    const sel = $("filtro-fab");
    sel.innerHTML = '<option value="">Todos los fabricantes</option>' +
      fabs.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join("");
    render();
  } catch (e) {
    toast("Error cargando datos: " + (e.message || e), false);
  }
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
      <td class="editor-only">
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
  $("modal-equipo-titulo").textContent = editar ? "Editar equipo" : "Nuevo equipo";
  $("e-categoria").value = e.categoria || "PCE";
  $("e-familia").value = e.familia || "";
  $("e-nombre").value = e.nombre || "";
  $("e-medida").value = e.medida || "";
  $("e-fabricante").value = e.fabricante || "";
  $("e-certificado").checked = !!(editar && e.certificado);
  $("modal-equipo").dataset.id = editar ? e.id : "";
  abrir("modal-equipo");
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
    const nuevoId = await Store.guardarEquipo(eq);
    cerrar("modal-equipo");
    toast("Equipo guardado.", true);
    await cargar();
    seleccionar(eq.id || nuevoId);
  } catch (e) { toast(e.message, false); }
}

// ---------- Edicion: consumible ----------
function abrirModalConsumible(c) {
  editandoConsumible = c || null;
  $("modal-cons-titulo").textContent = c ? "Editar consumible" : "Nuevo consumible";
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
    await Store.guardarConsumible(c);
    cerrar("modal-consumible");
    toast("Consumible guardado.", true);
    await cargar(); seleccionar(seleccionado.id);
  } catch (e) { toast(e.message, false); }
}
async function borrarConsumible() {
  if (!editandoConsumible || !editandoConsumible.id) return;
  if (!confirm("¿Borrar este consumible?")) return;
  try {
    await Store.borrarConsumible(editandoConsumible.id);
    cerrar("modal-consumible");
    toast("Consumible borrado.", true);
    await cargar(); seleccionar(seleccionado.id);
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
