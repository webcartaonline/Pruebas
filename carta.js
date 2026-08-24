/* =========================================================
   Carta online — diseño "Nocturno"
   Barra superior de secciones; debajo, los grupos de la
   sección elegida. Solo hay una sección visible a la vez.
   - Bilingüe ES / EN. Solo el texto es bilingüe; precio,
     alérgenos e id no dependen del idioma.
   - El JSON solo guarda NOMBRES de alérgenos; aquí se
     traducen a icono y etiqueta.
   ========================================================= */

const RUTA_JSON = 'carta.json';
const CLAVE_IDIOMA = 'barCerveceria.idioma';

/* ---------- Estadísticas de uso (opcional) ----------
   >>> ÚNICO CAMBIO NECESARIO PARA ACTIVARLAS <<<
   Pega aquí la dirección de tu Worker, terminada en /evento.
   Si se deja vacía, la carta funciona igual pero no envía nada. */
const ENDPOINT_EVENTOS = ''; // Pega aquí la dirección del Worker DE ESTE negocio, terminada en /evento. En blanco = la carta funciona igual pero no envía estadísticas.

/* Cada evento se manda UNA sola vez por visita. Si alguien abre y cierra
   la misma sección diez veces, cuenta como una. Así el dato es más honesto
   (mide interés, no nerviosismo) y no se agota la cuota de Cloudflare. */
const eventosEnviados = new Set();

function registrarEvento(tipo, valor) {
  if (!ENDPOINT_EVENTOS) return;

  const firma = `${tipo}:${valor}`;
  if (eventosEnviados.has(firma)) return;
  eventosEnviados.add(firma);

  try {
    const cuerpo = JSON.stringify({ tipo, valor });
    if (navigator.sendBeacon) {
      // OJO: se manda como 'text/plain' (no 'application/json') a propósito.
      // Con 'application/json' el navegador exige una comprobación previa
      // (preflight) entre dominios distintos, y sendBeacon no puede hacerla:
      // el envío se descarta en silencio y nunca llega al Worker.
      // 'text/plain' evita esa comprobación y el contenido sigue siendo
      // JSON válido; el Worker solo tiene que leerlo como texto y parsearlo.
      navigator.sendBeacon(ENDPOINT_EVENTOS, new Blob([cuerpo], { type: 'text/plain' }));
    } else {
      fetch(ENDPOINT_EVENTOS, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: cuerpo, keepalive: true })
        .catch(() => {});
    }
  } catch {
    // Un fallo al registrar estadísticas nunca debe afectar a la carta.
  }
}

/* ---------- Textos fijos de la interfaz (no salen del JSON) ---------- */
const UI = {
  es: {
    cargando: 'Cargando la carta…',
    errorCargar: 'No se ha podido cargar la carta',
    alergenosTitulo: 'Alérgenos',
    alergenosAyuda: 'Marca los que quieras evitar y te avisamos en cada plato. Consulta siempre al personal ante una alergia grave.',
    limpiar: 'Quitar todos los avisos',
    sinAlergenos: 'Sin alérgenos declarados',
    contiene: 'Contiene',
    actualizadoPre: 'Precios actualizados el',
    ivaNota: 'IVA incluido. Los precios pueden variar sin previo aviso.',
    unidades: (n) => `${n} ${n === 1 ? 'plato' : 'platos'}`
  },
  en: {
    cargando: 'Loading the menu…',
    errorCargar: 'The menu could not be loaded',
    alergenosTitulo: 'Allergens',
    alergenosAyuda: 'Tap the ones you want to avoid and we will flag them on each dish. Always ask our staff about serious allergies.',
    limpiar: 'Clear all warnings',
    sinAlergenos: 'No declared allergens',
    contiene: 'Contains',
    actualizadoPre: 'Prices updated on',
    ivaNota: 'VAT included. Prices may change without notice.',
    unidades: (n) => `${n} ${n === 1 ? 'item' : 'items'}`
  }
};

/* ---------- Catálogo de alérgenos (14 de declaración obligatoria) ---------- */
const ALERGENOS = {
  'gluten':       { es: 'Cereales con gluten', en: 'Cereals with gluten',
    icono: '<path d="M12 21V6"/><path d="M12 12c-2.4 0-4-1.6-4-4 2.4 0 4 1.6 4 4Z"/><path d="M12 12c2.4 0 4-1.6 4-4-2.4 0-4 1.6-4 4Z"/><path d="M12 17c-2.4 0-4-1.6-4-4 2.4 0 4 1.6 4 4Z"/><path d="M12 17c2.4 0 4-1.6 4-4-2.4 0-4 1.6-4 4Z"/>' },
  'crustaceos':   { es: 'Crustáceos', en: 'Crustaceans',
    icono: '<path d="M17 6c-5 0-9 3.4-9 7.5 0 2.6 1.8 4.5 4.2 4.5 2 0 3.3-1.3 3.3-2.9 0-1.4-1-2.4-2.3-2.4"/><path d="M17 6c1.7 0 2.9.9 3.5 2.2"/><path d="M8 13.6 4.2 16M8.7 16.2 5.2 18.8"/>' },
  'huevos':       { es: 'Huevos', en: 'Eggs',
    icono: '<path d="M12 3.5c3.3 0 6 4.2 6 8.2 0 4-2.7 7.3-6 7.3s-6-3.3-6-7.3c0-4 2.7-8.2 6-8.2Z"/><circle cx="12" cy="12.4" r="2.6"/>' },
  'pescado':      { es: 'Pescado', en: 'Fish',
    icono: '<path d="M4.5 12c2.8-3.8 6-5.6 9.3-5.6 2.6 0 4.6 1 6.2 2.6-1 1.2-1 4.8 0 6-1.6 1.6-3.6 2.6-6.2 2.6-3.3 0-6.5-1.8-9.3-5.6Z"/><path d="M4.5 12 8 9.4M4.5 12 8 14.6"/><circle cx="16.8" cy="10.6" r=".9" fill="currentColor" stroke="none"/>' },
  'cacahuetes':   { es: 'Cacahuetes', en: 'Peanuts',
    icono: '<path d="M12 4.4c2.3 0 4 1.7 4 3.8 0 1.5-.9 2.3-.9 3.8s.9 2.3.9 3.8c0 2.1-1.7 3.8-4 3.8s-4-1.7-4-3.8c0-1.5.9-2.3.9-3.8S8 9.7 8 8.2c0-2.1 1.7-3.8 4-3.8Z"/>' },
  'soja':         { es: 'Soja', en: 'Soya',
    icono: '<path d="M6 17.5c-1.6-1.6-1.6-4.2 0-5.8l6-6c1.6-1.6 4.2-1.6 5.8 0 1.6 1.6 1.6 4.2 0 5.8l-6 6c-1.6 1.6-4.2 1.6-5.8 0Z"/><circle cx="9.4" cy="14.6" r="1.5"/><circle cx="14.6" cy="9.4" r="1.5"/>' },
  'lacteos':      { es: 'Lácteos', en: 'Milk',
    icono: '<path d="M8 9.5h8V20H8z"/><path d="M8 9.5 9.9 4h4.2L16 9.5"/><path d="M8 13.4h8"/>' },
  'frutos-secos': { es: 'Frutos de cáscara', en: 'Tree nuts',
    icono: '<path d="M12 3.8c3.5 0 6.5 3.6 6.5 8 0 4.6-3 8.4-6.5 8.4S5.5 16.4 5.5 11.8c0-4.4 3-8 6.5-8Z"/><path d="M12 20.2V6.6"/><path d="M12 12.6c1.5-1.6 3.1-2.5 4.7-2.7M12 12.6c-1.5-1.6-3.1-2.5-4.7-2.7"/>' },
  'apio':         { es: 'Apio', en: 'Celery',
    icono: '<path d="M8.3 21c-.7-4.5-.6-9 .5-13.4M12 21c0-5 .1-10 .6-13.9M15.7 21c.7-4.5.6-9-.5-13.4"/>' },
  'mostaza':      { es: 'Mostaza', en: 'Mustard',
    icono: '<path d="M9 21h6a1.5 1.5 0 0 0 1.5-1.5V11a4.5 4.5 0 0 0-3-4.2V4.5h-3v2.3A4.5 4.5 0 0 0 7.5 11v8.5A1.5 1.5 0 0 0 9 21Z"/><path d="M7.5 13.4h9"/>' },
  'sesamo':       { es: 'Sésamo', en: 'Sesame',
    icono: '<ellipse cx="8.5" cy="9" rx="2" ry="3.1" transform="rotate(-25 8.5 9)"/><ellipse cx="15.6" cy="10.6" rx="2" ry="3.1" transform="rotate(22 15.6 10.6)"/><ellipse cx="11.6" cy="16.4" rx="2" ry="3.1" transform="rotate(-8 11.6 16.4)"/>' },
  'sulfitos':     { es: 'Sulfitos', en: 'Sulphites',
    icono: '<path d="M7.5 3.5h9l-.8 6a3.7 3.7 0 0 1-7.4 0Z"/><path d="M12 15.3V20"/><path d="M8.6 20h6.8"/>' },
  'altramuces':   { es: 'Altramuces', en: 'Lupin',
    icono: '<circle cx="9" cy="8.8" r="3.2"/><circle cx="15.4" cy="11.6" r="3.2"/><circle cx="10.4" cy="16.2" r="3.2"/>' },
  'moluscos':     { es: 'Moluscos', en: 'Molluscs',
    icono: '<path d="M12 20c-4.4 0-8-3.4-8-7.6C4 8 7.6 4 12 4s8 4 8 8.4c0 4.2-3.6 7.6-8 7.6Z"/><path d="M12 20V4M12 20 7.1 6.7M12 20l4.9-13.3"/>' }
};

const ICONO_DESCONOCIDO = '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.4a2.3 2.3 0 1 1 2.9 2.2c-.5.2-.7.6-.7 1.1v.6"/><circle cx="12" cy="16.4" r=".9" fill="currentColor" stroke="none"/>';

/* ---------- Estado ---------- */
const app = {
  datos: null,
  idioma: 'es',
  idiomas: ['es'],   // se rellena al cargar el JSON
  evitar: new Set(),
  seccionActiva: null
};

const $ = (s) => document.querySelector(s);

/* Idiomas disponibles: los que declare el JSON en negocio.idiomas,
   o, si no los declara, se deducen de la forma de los textos. */
function detectarIdiomas(datos) {
  const declarados = datos?.negocio?.idiomas;
  if (Array.isArray(declarados) && declarados.length) {
    return declarados.map((x) => String(x).toLowerCase());
  }
  const claves = new Set();
  const mirar = (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.keys(v).forEach((k) => claves.add(k));
    }
  };
  mirar(datos?.negocio?.lema);
  (datos?.secciones ?? []).forEach((s) => {
    mirar(s.nombre);
    (s.grupos ?? []).forEach((g) => {
      mirar(g.nombre);
      (g.items ?? []).forEach((it) => { mirar(it.nombre); mirar(it.descripcion); });
    });
  });
  const lista = [...claves];
  lista.sort((a, b) => (a === 'es' ? -1 : b === 'es' ? 1 : a.localeCompare(b)));
  return lista.length ? lista : ['es'];
}

/* ---------- Utilidades ---------- */

// Devuelve el texto en el idioma activo, con respaldo al español,
// y tolera que el campo sea un texto plano en vez de un objeto {es,en}.
function t(campo) {
  if (campo == null) return '';
  if (typeof campo === 'string') return campo;
  return campo[app.idioma] || campo.es || campo.en || '';
}

function ui() { return UI[app.idioma] || UI.es; }

function euros(precio) {
  const loc = app.idioma === 'en' ? 'en-IE' : 'es-ES';
  return new Intl.NumberFormat(loc, { style: 'currency', currency: 'EUR' }).format(Number(precio) || 0);
}

function escapar(x) {
  return String(x ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function normalizar(nombre) {
  return String(nombre ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '-');
}

function datosAlergeno(nombre) {
  const clave = normalizar(nombre);
  const ficha = ALERGENOS[clave];
  return {
    clave,
    etiqueta: ficha ? (ficha[app.idioma] || ficha.es) : nombre,
    icono: ficha ? ficha.icono : ICONO_DESCONOCIDO
  };
}

function svg(contenido) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">${contenido}</svg>`;
}

function secciones() { return app.datos?.secciones ?? []; }

function indiceActivo() {
  const i = secciones().findIndex((s) => s.id === app.seccionActiva);
  return i < 0 ? 0 : i;
}

/* ---------- Carga ---------- */

async function cargar() {
  const estado = $('#estado');
  try {
    const r = await fetch(RUTA_JSON, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${r.status}`);
    app.datos = await r.json();
    // Compatibilidad: si el JSON viene sin secciones pero con grupos sueltos,
    // los envolvemos en una sección para no romper el pintado.
    if (!app.datos.secciones && app.datos.grupos) {
      app.datos.secciones = [{ id: 's-general', nombre: { es: 'Carta', en: 'Menu' }, grupos: app.datos.grupos }];
    }
    app.idiomas = detectarIdiomas(app.datos);
    if (!app.idiomas.includes(app.idioma)) app.idioma = app.idiomas[0];
    if (!app.seccionActiva && secciones().length) app.seccionActiva = secciones()[0].id;

    pintarTodo();
    registrarEvento('vista', 'carta');
    registrarEvento('idioma', app.idioma); // incluye el idioma detectado al entrar
  } catch (e) {
    estado.className = 'estado estado--error';
    estado.textContent = `${ui().errorCargar} (${e.message}).`;
  }
}

/* ---------- Pintado ---------- */

function pintarTodo() {
  pintarTextosFijos();
  pintarNegocio();
  pintarBarra();
  pintarPanel();
  pintarLeyenda();
  actualizarFiltro();
  document.documentElement.lang = app.idioma;

  // Selector de idioma: solo si hay más de un idioma disponible.
  const selector = $('.idioma');
  if (selector) {
    selector.hidden = app.idiomas.length < 2;
    selector.querySelectorAll('.idioma__btn').forEach((b) => {
      b.hidden = !app.idiomas.includes(b.dataset.idioma);
      b.setAttribute('aria-pressed', b.dataset.idioma === app.idioma);
    });
  }
}

function pintarTextosFijos() {
  const dic = ui();
  document.querySelectorAll('[data-t]').forEach((el) => {
    const clave = el.dataset.t;
    if (clave === 'nombre' || clave === 'lema') return; // salen del JSON
    if (typeof dic[clave] === 'string') el.textContent = dic[clave];
  });
}

function pintarNegocio() {
  const n = app.datos.negocio ?? {};
  $('[data-t="nombre"]').textContent = n.nombre ?? 'Carta';
  $('[data-t="lema"]').textContent = t(n.lema);
  document.title = n.nombre ?? 'Carta';

  if (n.actualizado) {
    const loc = app.idioma === 'en' ? 'en-GB' : 'es-ES';
    $('[data-campo="actualizado"]').textContent =
      new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' })
        .format(new Date(n.actualizado));
  }
}

/* Barra superior: una pestaña por sección. */
function pintarBarra() {
  $('#indice').innerHTML = secciones().map((sec) => {
    const activa = sec.id === app.seccionActiva;
    return `
      <button class="barra__btn" type="button" role="tab"
              id="tab-${escapar(sec.id)}"
              data-seccion="${escapar(sec.id)}"
              aria-selected="${activa}"
              aria-controls="carta"
              tabindex="${activa ? '0' : '-1'}">
        <span class="barra__nombre">${escapar(t(sec.nombre))}</span>
      </button>`;
  }).join('');
}

/* Debajo de la barra: los grupos de la sección elegida. */
function pintarPanel() {
  const lista = secciones();
  const i = indiceActivo();
  const sec = lista[i];
  const carta = $('#carta');

  if (!sec) { carta.innerHTML = ''; return; }

  carta.setAttribute('aria-labelledby', `tab-${sec.id}`);

  // Con imagen: el título se dibuja DENTRO del contenedor, superpuesto a la
  // foto. Si la foto no llega a cargar, solo se quita la imagen (la clase
  // --sin-imagen colapsa el contenedor); el título nunca desaparece.
  const cabeceraTitulo = sec.imagen
    ? `<div class="panel__imagen-envoltorio">
        <img class="panel__imagen" src="${escapar(sec.imagen)}" alt=""
             loading="lazy"
             onerror="this.closest('.panel__imagen-envoltorio').classList.add('panel__imagen-envoltorio--sin-imagen');this.remove()">
        <h2 class="panel__titulo panel__titulo--sobre-imagen">${escapar(t(sec.nombre))}</h2>
      </div>`
    : `<h2 class="panel__titulo">${escapar(t(sec.nombre))}</h2>`;

  carta.innerHTML = `
    <header class="panel__cabecera">
      ${cabeceraTitulo}
      <span class="panel__filo" aria-hidden="true"></span>
    </header>
    ${(sec.grupos ?? []).map(pintarGrupo).join('')}`;
}

function pintarGrupo(grupo) {
  const items = grupo.items ?? [];
  return `
    <section class="grupo">
      <header class="grupo__cabecera">
        <h3 class="grupo__titulo">${escapar(t(grupo.nombre))}</h3>
        <span class="grupo__regla" aria-hidden="true"></span>
        <span class="grupo__conteo">${ui().unidades(items.length)}</span>
      </header>
      <div class="grupo__items">${items.map(pintarItem).join('')}</div>
    </section>`;
}

function pintarItem(item) {
  const fichas = (Array.isArray(item.alergenos) ? item.alergenos : []).map(datosAlergeno);
  const enConflicto = fichas.filter((f) => app.evitar.has(f.clave));

  const listaFichas = fichas.length
    ? `<ul class="item__alergenos">
        ${fichas.map((f) => `
          <li class="ficha ${app.evitar.has(f.clave) ? 'ficha--evitar' : ''}"
              role="img" aria-label="${ui().contiene} ${escapar(f.etiqueta.toLowerCase())}"
              title="${escapar(f.etiqueta)}">${svg(f.icono)}</li>`).join('')}
      </ul>`
    : `<span class="item__limpio">${ui().sinAlergenos}</span>`;

  const aviso = enConflicto.length
    ? `<p class="item__aviso">${ui().contiene} ${
        enConflicto.map((f) => escapar(f.etiqueta.toLowerCase())).join(', ')
      }</p>`
    : '';

  const descripcion = t(item.descripcion);

  return `
    <article class="item ${enConflicto.length ? 'item--evitar' : ''}">
      <div class="item__linea">
        <h4 class="item__nombre">${escapar(t(item.nombre))}</h4>
        <span class="item__precio">${euros(item.precio)}</span>
      </div>
      ${descripcion ? `<p class="item__descripcion">${escapar(descripcion)}</p>` : ''}
      ${listaFichas}
      ${aviso}
    </article>`;
}

/* Filtro: solo se listan los alérgenos que aparecen en la carta. */
function pintarLeyenda() {
  const presentes = new Set();
  secciones().forEach((s) =>
    (s.grupos ?? []).forEach((g) =>
      (g.items ?? []).forEach((i) =>
        (i.alergenos ?? []).forEach((a) => presentes.add(normalizar(a))))));

  const orden = Object.keys(ALERGENOS).filter((c) => presentes.has(c));
  [...presentes].forEach((c) => { if (!orden.includes(c)) orden.push(c); });

  $('#leyenda').innerHTML = orden.map((clave) => {
    const f = datosAlergeno(clave);
    return `
      <li>
        <button class="filtro__boton" type="button"
                data-alergeno="${escapar(clave)}"
                aria-pressed="${app.evitar.has(clave)}">
          ${svg(f.icono)}<span>${escapar(f.etiqueta)}</span>
        </button>
      </li>`;
  }).join('');
}

/* Marca con el número de alérgenos activos, visible con el filtro plegado. */
function actualizarFiltro() {
  const n = app.evitar.size;
  const marca = $('#filtroMarca');
  marca.textContent = n;
  marca.hidden = n === 0;
  $('#limpiarFiltros').hidden = n === 0;
}

/* ---------- Interacción ---------- */

function elegirSeccion(id, { moverFoco = false } = {}) {
  if (id === app.seccionActiva) return;
  app.seccionActiva = id;
  registrarEvento('seccion', id);

  pintarBarra();
  pintarPanel();

  const btn = $(`[data-seccion="${CSS.escape(id)}"]`);
  if (btn) {
    if (moverFoco) btn.focus();
    btn.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  // Si se estaba leyendo a media página, volvemos al principio de la sección
  // nueva, dejando hueco para la barra pegada arriba.
  const barra = $('#barra');
  const lienzo = $('#carta');
  const tope = lienzo.getBoundingClientRect().top + window.scrollY - barra.offsetHeight - 12;
  if (window.scrollY > tope) {
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: tope, behavior: suave ? 'smooth' : 'auto' });
  }
}

document.addEventListener('click', (ev) => {
  const t0 = ev.target;

  // Cambiar idioma
  const btnIdioma = t0.closest('[data-idioma]');
  if (btnIdioma) {
    app.idioma = btnIdioma.dataset.idioma;
    try { localStorage.setItem(CLAVE_IDIOMA, app.idioma); } catch {}
    pintarTodo();
    registrarEvento('idioma', app.idioma);
    return;
  }

  // Elegir sección en la barra superior
  const btnSeccion = t0.closest('[data-seccion]');
  if (btnSeccion) {
    elegirSeccion(btnSeccion.dataset.seccion);
    return;
  }

  // Marcar / desmarcar alérgeno a evitar
  const btnAlergeno = t0.closest('[data-alergeno]');
  if (btnAlergeno) {
    const clave = btnAlergeno.dataset.alergeno;
    if (app.evitar.has(clave)) {
      app.evitar.delete(clave);
    } else {
      app.evitar.add(clave);
      registrarEvento('alergeno', clave);
    }
    pintarPanel();
    pintarLeyenda();
    actualizarFiltro();
    return;
  }

  if (t0.closest('#limpiarFiltros')) {
    app.evitar.clear();
    pintarPanel();
    pintarLeyenda();
    actualizarFiltro();
  }
});

/* Flechas para moverse entre secciones, como en cualquier grupo de pestañas. */
$('#indice').addEventListener('keydown', (ev) => {
  const teclas = { ArrowLeft: -1, ArrowRight: 1, Home: 'inicio', End: 'fin' };
  const salto = teclas[ev.key];
  if (salto === undefined) return;

  const lista = secciones();
  if (!lista.length) return;
  ev.preventDefault();

  let i;
  if (salto === 'inicio') i = 0;
  else if (salto === 'fin') i = lista.length - 1;
  else i = (indiceActivo() + salto + lista.length) % lista.length;

  elegirSeccion(lista[i].id, { moverFoco: true });
});

/* ---------- Arranque: idioma guardado o el del navegador ---------- */
(function idiomaInicial() {
  let guardado = null;
  try { guardado = localStorage.getItem(CLAVE_IDIOMA); } catch {}
  if (guardado === 'es' || guardado === 'en') {
    app.idioma = guardado;
  } else if ((navigator.language || '').toLowerCase().startsWith('en')) {
    app.idioma = 'en';
  }
})();

cargar();