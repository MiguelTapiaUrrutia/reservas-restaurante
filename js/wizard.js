// js/wizard.js — asistente de reserva en 3 pasos (módulo ES).
//
// La UI es una máquina de estados chica: TODO lo visible sale de `estado`
// y lo pinta render(). Nunca se muestran/ocultan nodos a mano acumulando
// clases: cambiar de paso = crear un estado nuevo + volver a renderizar.
//
// Las reglas de negocio NO viven aquí. Este módulo solo llama a
// esFechaValida / mesasDisponibles / asignarMesa / puedeReservar
// (globales de reglas.js) y a fechas.js / storage.js, cargados como
// scripts clásicos antes que este módulo.

const TOTAL_PASOS = 3;
const TITULOS_PASO = { 1: '¿Cuándo?', 2: '¿Cuántos?', 3: 'Tus datos' };

const PERSONAS_MINIMAS = 1;
const PERSONAS_INICIALES = 2;
const LARGO_MAXIMO_NOMBRE = 60;

// Móvil chileno: +56 9 1234 5678 — prefijo +56 y espacios opcionales.
const PATRON_TELEFONO = /^(\+?56\s?)?9\s?\d{4}\s?\d{4}$/;
const FORMATO_TELEFONO = '+56 9 1234 5678';

// Código de reserva: sin 0/O ni 1/I/L, que se confunden al leerlo
// en pantalla o dictarlo por teléfono. Quedan 31 símbolos.
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LARGO_CODIGO = 6;

const NOMBRES_MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Éxito/error/aviso SIEMPRE llevan icono + texto, nunca solo color (WCAG 1.4.1).
const ICONOS = {
  error:
    '<svg class="banner-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M9 9l6 6m0-6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  aviso:
    '<svg class="banner-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 4 3 20h18Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M12 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="12" cy="17" r="1" fill="currentColor"/></svg>',
  exito:
    '<svg class="ticket-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M8 12.5l2.5 2.5L16 9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check:
    '<svg class="radio-card-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M5 13l4 4 10-10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const contenedor = document.getElementById('wizard');

let config = null;
let estado = crearEstadoInicial();
let pantallaConFoco = null;   // qué pantalla ya recibió foco (no robarlo al cargar)
let focoTrasRender = null;    // selector a enfocar tras re-render del MISMO paso

function crearEstadoInicial() {
  return {
    pasoActual: 1,
    solicitud: { fecha: '', turno: '', personas: PERSONAS_INICIALES, nombre: '', telefono: '' },
    aviso: null,   // { tipo: 'error' | 'aviso', mensaje, accion? }
    ticket: null,  // reserva confirmada → render() muestra el comprobante
  };
}

// Único punto de cambio: reemplaza el estado por una copia con los cambios
// y re-renderiza. Nadie muta `estado` directamente.
function setEstado(cambios) {
  estado = { ...estado, ...cambios };
  render();
}

/* ============================================================
   Arranque
   ============================================================ */

async function iniciar() {
  try {
    const respuesta = await fetch('data/config.json');
    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}`);
    }
    config = await respuesta.json();
  } catch (error) {
    console.error('wizard: no se pudo cargar data/config.json', error);
    contenedor.innerHTML =
      `<div class="banner banner--error" role="alert">${ICONOS.error}` +
      '<p>No pudimos cargar la configuración del restaurante. ' +
      'Sirve el sitio desde un servidor local (por ejemplo <code>npx serve</code>) y recarga.</p></div>';
    return;
  }

  // Modo demo (?demo=1): si js/seed.js está cargado, siembra reservas
  // ficticias ANTES del primer render. Ver cabecera de js/seed.js.
  if (typeof sembrarDatosDemo === 'function') {
    sembrarDatosDemo(config);
  }

  pintarAmbiente();
  render();
}

// La sección de ambiente también lee config: horarios y día de cierre
// salen de data/config.json, no de texto duplicado en el HTML.
function pintarAmbiente() {
  const horarios = document.getElementById('horarios');
  const notaCierre = document.getElementById('nota-cierre');
  if (!horarios || !notaCierre) {
    return;
  }

  horarios.innerHTML = config.turnos
    .map(
      (turno) =>
        `<div class="horario-fila"><dt>${escaparHtml(etiquetaTurno(turno.id))}</dt>` +
        `<dd>${escaparHtml(turno.hora)} hrs</dd></div>`
    )
    .join('');

  notaCierre.textContent = `Cerramos los ${listaEnEspanol(config.diasCerrado)}.`;
}

/* ============================================================
   Render: el estado decide qué se ve
   ============================================================ */

function render() {
  if (estado.ticket) {
    contenedor.innerHTML = htmlTicket(estado.ticket);
    conectarEventos();
    moverFoco('ticket');
    return;
  }

  const paso = estado.pasoActual;
  contenedor.innerHTML = htmlProgreso(paso) + htmlPaso(paso);
  conectarEventos();
  moverFoco(paso);
}

// Mueve el foco al título cuando CAMBIA la pantalla. En el primer render
// no roba el foco (la persona puede estar leyendo el hero). Si el re-render
// fue dentro del mismo paso (stepper de personas), restaura el foco al
// control que se usó, porque innerHTML lo destruyó.
function moverFoco(pantalla) {
  if (focoTrasRender !== null) {
    const control = contenedor.querySelector(focoTrasRender);
    if (control && !control.disabled) {
      control.focus();
    } else {
      contenedor.querySelector('.stepper-btn:not(:disabled)')?.focus();
    }
    focoTrasRender = null;
    pantallaConFoco = pantalla;
    return;
  }

  if (pantallaConFoco !== null && pantallaConFoco !== pantalla) {
    contenedor.querySelector('#paso-titulo')?.focus();
  }
  pantallaConFoco = pantalla;
}

function htmlProgreso(paso) {
  const segmentos = [1, 2, 3]
    .map((n) => {
      const clase = n === paso ? ' class="activo"' : n < paso ? ' class="completado"' : '';
      const actual = n === paso ? ' aria-current="step"' : '';
      const estadoLegible = n === paso ? ' (paso actual)' : n < paso ? ' (completado)' : '';
      return `<li${clase}${actual}><span class="sr-only">Paso ${n}: ${TITULOS_PASO[n]}${estadoLegible}</span></li>`;
    })
    .join('');

  return (
    `<nav class="progreso" aria-label="Progreso de la reserva">` +
    `<p class="progreso-texto">Paso ${paso} de ${TOTAL_PASOS}</p>` +
    `<ol class="progreso-segmentos">${segmentos}</ol></nav>`
  );
}

function htmlPaso(paso) {
  const constructores = { 1: htmlPaso1, 2: htmlPaso2, 3: htmlPaso3 };
  return constructores[paso]();
}

function htmlBanner(aviso) {
  if (!aviso) {
    return '';
  }
  const icono = aviso.tipo === 'error' ? ICONOS.error : ICONOS.aviso;
  const boton =
    aviso.accion === 'cambiar-fecha'
      ? '<button type="button" class="banner-accion" data-accion="cambiar-fecha">Cambiar fecha</button>'
      : '';
  return (
    `<div class="banner banner--${aviso.tipo}" role="alert">` +
    `${icono}<p>${escaparHtml(aviso.mensaje)}</p>${boton}</div>`
  );
}

function htmlTituloPaso(paso) {
  return `<h3 class="paso-titulo" id="paso-titulo" tabindex="-1">${TITULOS_PASO[paso]}</h3>`;
}

/* --- Paso 1: fecha y turno --- */

function htmlPaso1() {
  const { fecha, turno } = estado.solicitud;
  const hoy = fechaHoy();
  const fechaMaxima = sumarDias(hoy, config.anticipacionMaximaDias);

  const tarjetasTurno = config.turnos
    .map((t) => {
      const marcado = turno === t.id ? ' checked' : '';
      return (
        `<label class="radio-card">` +
        `<input type="radio" name="turno" value="${escaparHtml(t.id)}"${marcado} />` +
        `<span class="radio-card-titulo">${escaparHtml(etiquetaTurno(t.id))}</span>` +
        `<span class="radio-card-hora">${escaparHtml(t.hora)} hrs</span>` +
        ICONOS.check +
        `</label>`
      );
    })
    .join('');

  return (
    `<form class="formulario-paso" novalidate>` +
    htmlTituloPaso(1) +
    htmlBanner(estado.aviso) +
    `<div class="campo">` +
    `<label class="campo-etiqueta" for="campo-fecha">Fecha de tu visita</label>` +
    `<input type="date" id="campo-fecha" name="fecha" value="${escaparHtml(fecha)}"` +
    ` min="${hoy}" max="${fechaMaxima}" aria-describedby="ayuda-fecha" required />` +
    `<span class="campo-ayuda" id="ayuda-fecha">Hasta ${config.anticipacionMaximaDias} días desde hoy. ` +
    `Cerramos los ${escaparHtml(listaEnEspanol(config.diasCerrado))}.</span>` +
    `</div>` +
    `<fieldset class="campo" style="border:none;padding:0;margin:0">` +
    `<legend class="campo-etiqueta">Turno</legend>` +
    `<div class="radio-cards">${tarjetasTurno}</div>` +
    `</fieldset>` +
    `<div class="botonera botonera--final">` +
    `<button type="submit" class="boton boton--primario">Continuar</button>` +
    `</div></form>`
  );
}

/* --- Paso 2: personas --- */

function htmlPaso2() {
  const { personas } = estado.solicitud;
  const maximo = capacidadMaxima();
  const unidad = personas === 1 ? 'persona' : 'personas';

  return (
    `<form class="formulario-paso" novalidate>` +
    htmlTituloPaso(2) +
    htmlBanner(estado.aviso) +
    `<div class="stepper" role="group" aria-label="Número de personas">` +
    `<button type="button" class="stepper-btn" data-accion="menos"` +
    ` aria-label="Quitar una persona"${personas <= PERSONAS_MINIMAS ? ' disabled' : ''}>&minus;</button>` +
    `<output class="stepper-valor">${personas}<span class="stepper-unidad">${unidad}</span></output>` +
    `<button type="button" class="stepper-btn" data-accion="mas"` +
    ` aria-label="Agregar una persona"${personas >= maximo ? ' disabled' : ''}>+</button>` +
    `</div>` +
    `<p class="campo-ayuda">Grupos de hasta ${maximo} personas. Para más, llámanos.</p>` +
    `<div class="botonera">` +
    `<button type="button" class="boton boton--secundario" data-accion="atras">Atrás</button>` +
    `<button type="submit" class="boton boton--primario">Continuar</button>` +
    `</div></form>`
  );
}

/* --- Paso 3: datos de contacto + resumen editable --- */

function htmlPaso3() {
  const { fecha, turno, personas, nombre, telefono } = estado.solicitud;
  const unidad = personas === 1 ? 'persona' : 'personas';

  const resumen =
    `<dl class="resumen">` +
    `<div class="resumen-fila"><dt>Fecha</dt><dd>${escaparHtml(fechaLegible(fecha))}</dd>` +
    `<button type="button" class="boton-editar" data-accion="editar" data-paso="1">Editar<span class="sr-only"> la fecha (vuelve al paso 1)</span></button></div>` +
    `<div class="resumen-fila"><dt>Turno</dt><dd>${escaparHtml(etiquetaTurno(turno))} · ${escaparHtml(horaTurno(turno))} hrs</dd>` +
    `<button type="button" class="boton-editar" data-accion="editar" data-paso="1">Editar<span class="sr-only"> el turno (vuelve al paso 1)</span></button></div>` +
    `<div class="resumen-fila"><dt>Personas</dt><dd>${personas} ${unidad}</dd>` +
    `<button type="button" class="boton-editar" data-accion="editar" data-paso="2">Editar<span class="sr-only"> las personas (vuelve al paso 2)</span></button></div>` +
    `</dl>`;

  return (
    `<form class="formulario-paso" novalidate>` +
    htmlTituloPaso(3) +
    htmlBanner(estado.aviso) +
    resumen +
    `<div class="campo">` +
    `<label class="campo-etiqueta" for="campo-nombre">Nombre</label>` +
    `<input type="text" id="campo-nombre" name="nombre" value="${escaparHtml(nombre)}"` +
    ` maxlength="${LARGO_MAXIMO_NOMBRE}" autocomplete="name" required />` +
    `</div>` +
    `<div class="campo">` +
    `<label class="campo-etiqueta" for="campo-telefono">Teléfono</label>` +
    `<input type="tel" id="campo-telefono" name="telefono" value="${escaparHtml(telefono)}"` +
    ` inputmode="tel" autocomplete="tel" aria-describedby="ayuda-telefono"` +
    ` pattern="(\\+?56 ?)?9 ?\\d{4} ?\\d{4}" required />` +
    `<span class="campo-ayuda" id="ayuda-telefono">Formato: ${FORMATO_TELEFONO}</span>` +
    `</div>` +
    `<div class="botonera">` +
    `<button type="button" class="boton boton--secundario" data-accion="atras">Atrás</button>` +
    `<button type="submit" class="boton boton--primario">Confirmar reserva</button>` +
    `</div></form>`
  );
}

/* --- Ticket de confirmación --- */

function htmlTicket(ticket) {
  const unidad = ticket.personas === 1 ? 'persona' : 'personas';

  return (
    `<div class="ticket"><div class="ticket-cuerpo">` +
    `<h3 class="ticket-titulo" id="paso-titulo" tabindex="-1">${ICONOS.exito}Reserva confirmada</h3>` +
    `<p class="ticket-codigo-etiqueta">Código de reserva</p>` +
    `<p class="ticket-codigo">${escaparHtml(ticket.codigo)}</p>` +
    `<hr class="ticket-separador" />` +
    `<dl class="ticket-datos">` +
    `<div><dt>Fecha</dt><dd>${escaparHtml(fechaLegible(ticket.fecha))}</dd></div>` +
    `<div><dt>Turno</dt><dd>${escaparHtml(etiquetaTurno(ticket.turno))} ${escaparHtml(horaTurno(ticket.turno))} hrs</dd></div>` +
    `<div><dt>Personas</dt><dd>${ticket.personas} ${unidad}</dd></div>` +
    `<div><dt>Mesa</dt><dd>${escaparHtml(ticket.mesaId)} (hasta ${ticket.capacidad})</dd></div>` +
    `<div><dt>A nombre de</dt><dd>${escaparHtml(ticket.nombre)}</dd></div>` +
    `</dl>` +
    `<p class="ticket-nota">Guarda el código: lo pediremos al llegar.</p>` +
    `<button type="button" class="boton boton--primario" data-accion="otra-reserva">Hacer otra reserva</button>` +
    `</div></div>`
  );
}

/* ============================================================
   Eventos y transiciones
   ============================================================ */

function conectarEventos() {
  const formulario = contenedor.querySelector('form');
  if (formulario) {
    // Enter en cualquier campo dispara el submit → avanza de paso.
    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      continuar();
    });
  }

  contenedor.querySelectorAll('[data-accion]').forEach((boton) => {
    boton.addEventListener('click', manejarAccion);
  });
}

function manejarAccion(evento) {
  const accion = evento.currentTarget.dataset.accion;

  if (accion === 'atras') {
    setEstado({
      solicitud: capturarCamposDePaso(),
      pasoActual: estado.pasoActual - 1,
      aviso: null,
    });
  } else if (accion === 'editar') {
    setEstado({
      solicitud: capturarCamposDePaso(),
      pasoActual: Number(evento.currentTarget.dataset.paso),
      aviso: null,
    });
  } else if (accion === 'cambiar-fecha') {
    // Desde el banner "sin mesa": vuelve al paso 1 conservando todo lo demás.
    setEstado({ pasoActual: 1, aviso: null });
  } else if (accion === 'mas' || accion === 'menos') {
    cambiarPersonas(accion === 'mas' ? 1 : -1);
  } else if (accion === 'otra-reserva') {
    estado = crearEstadoInicial();
    render();
  }
}

function continuar() {
  const transiciones = { 1: continuarDesdePaso1, 2: continuarDesdePaso2, 3: confirmarReserva };
  transiciones[estado.pasoActual]();
}

// Lee del DOM los campos del paso visible y devuelve una solicitud NUEVA.
// El estado solo se sincroniza con los inputs en las transiciones (continuar,
// atrás, editar): así Atrás nunca pierde lo escrito y no hace falta
// re-renderizar en cada tecla.
function capturarCamposDePaso() {
  const solicitud = { ...estado.solicitud };

  if (estado.pasoActual === 1) {
    solicitud.fecha = contenedor.querySelector('#campo-fecha')?.value ?? solicitud.fecha;
    solicitud.turno =
      contenedor.querySelector('input[name="turno"]:checked')?.value ?? solicitud.turno;
  } else if (estado.pasoActual === 3) {
    solicitud.nombre = contenedor.querySelector('#campo-nombre')?.value ?? solicitud.nombre;
    solicitud.telefono = contenedor.querySelector('#campo-telefono')?.value ?? solicitud.telefono;
  }
  // El paso 2 (personas) ya vive en el estado: el stepper lo actualiza al tiro.

  return solicitud;
}

/* --- Transición paso 1 → 2 --- */

function continuarDesdePaso1() {
  const solicitud = capturarCamposDePaso();

  if (!solicitud.fecha) {
    setEstado({ solicitud, aviso: { tipo: 'error', mensaje: 'Elige una fecha para tu visita.' } });
    return;
  }
  if (!solicitud.turno) {
    setEstado({ solicitud, aviso: { tipo: 'error', mensaje: 'Elige un turno: almuerzo o cena.' } });
    return;
  }

  const resultado = esFechaValida(solicitud.fecha, fechaHoy(), config);
  if (!resultado.valida) {
    // El motivo factual viene de reglas.js; aquí solo le sumamos una
    // alternativa concreta, en tono de propuesta, no de reproche.
    const mensaje = `${resultado.motivo} ${sugerenciaDeFecha(solicitud.fecha)}`.trim();
    setEstado({ solicitud, aviso: { tipo: 'aviso', mensaje } });
    return;
  }

  setEstado({ solicitud, pasoActual: 2, aviso: null });
}

// Propone una salida concreta según el motivo del rechazo, reutilizando
// las mismas reglas (sin duplicar su lógica: les pregunta, no las copia).
function sugerenciaDeFecha(fecha) {
  const hoy = fechaHoy();

  if (esAnterior(fecha, hoy)) {
    return '¿Buscamos un día de hoy en adelante?';
  }

  const limite = sumarDias(hoy, config.anticipacionMaximaDias);
  if (esAnterior(limite, fecha)) {
    const cercana = fechaValidaCercana(limite, -1);
    return cercana ? `Lo más lejos que llega nuestra agenda es el ${fechaLegible(cercana)}.` : '';
  }

  // Día cerrado: proponer el siguiente día abierto.
  const siguiente = fechaValidaCercana(sumarDias(fecha, 1), 1);
  return siguiente ? `¿Te acomoda el ${fechaLegible(siguiente)}?` : '';
}

// Busca, día a día en la dirección dada, la primera fecha que las
// reglas aceptan (máximo una semana de búsqueda).
function fechaValidaCercana(desde, direccion) {
  let candidata = desde;
  for (let i = 0; i < 7; i++) {
    if (esFechaValida(candidata, fechaHoy(), config).valida) {
      return candidata;
    }
    candidata = sumarDias(candidata, direccion);
  }
  return null;
}

/* --- Paso 2: stepper y transición 2 → 3 --- */

function cambiarPersonas(delta) {
  const { personas } = estado.solicitud;
  const nuevas = Math.min(capacidadMaxima(), Math.max(PERSONAS_MINIMAS, personas + delta));
  if (nuevas === personas) {
    return;
  }

  // El re-render destruye el botón pulsado: anotamos a quién devolver el foco.
  focoTrasRender = `[data-accion="${delta > 0 ? 'mas' : 'menos'}"]`;
  setEstado({ solicitud: { ...estado.solicitud, personas: nuevas }, aviso: null });
}

function continuarDesdePaso2() {
  const { fecha, turno, personas } = estado.solicitud;
  const reservas = cargarReservas();
  const mesa = asignarMesa(personas, mesasDisponibles(fecha, turno, reservas, config));

  if (mesa === null) {
    setEstado({ aviso: avisoSinMesa(personas, fecha, turno, reservas) });
    return;
  }

  setEstado({ pasoActual: 3, aviso: null });
}

// Sin mesa: antes de rendirnos, miramos si el OTRO turno del mismo día
// tiene lugar, para proponerlo con nombre y apellido.
function avisoSinMesa(personas, fecha, turno, reservas) {
  const otroTurno = config.turnos.find((t) => t.id !== turno);
  const hayEnOtroTurno =
    otroTurno !== undefined &&
    asignarMesa(personas, mesasDisponibles(fecha, otroTurno.id, reservas, config)) !== null;

  const base = `Para ${etiquetaTurno(turno).toLowerCase()} de ese día no nos queda mesa de ${personas}`;
  const propuesta = hayEnOtroTurno
    ? `, pero en ${etiquetaTurno(otroTurno.id).toLowerCase()} sí tenemos lugar: vuelve atrás y cambia el turno, o prueba otra fecha.`
    : `. Prueba con otra fecha y te buscamos un hueco.`;

  return { tipo: 'aviso', mensaje: base + propuesta, accion: 'cambiar-fecha' };
}

/* --- Transición paso 3 → confirmación --- */

function confirmarReserva() {
  const solicitud = capturarCamposDePaso();
  const nombre = solicitud.nombre.trim();
  const telefono = solicitud.telefono.trim();

  if (nombre.length === 0) {
    setEstado({ solicitud, aviso: { tipo: 'error', mensaje: 'Necesitamos un nombre para la reserva.' } });
    return;
  }
  if (nombre.length > LARGO_MAXIMO_NOMBRE) {
    setEstado({
      solicitud,
      aviso: { tipo: 'error', mensaje: `El nombre no puede superar los ${LARGO_MAXIMO_NOMBRE} caracteres.` },
    });
    return;
  }
  if (!PATRON_TELEFONO.test(telefono)) {
    setEstado({
      solicitud,
      aviso: { tipo: 'error', mensaje: `Revisa el teléfono: el formato es ${FORMATO_TELEFONO}.` },
    });
    return;
  }

  // Verificación FINAL contra el motor de reglas, con las reservas frescas:
  // entre el paso 2 y este clic pudo entrar otra reserva (otra pestaña).
  const reservas = cargarReservas();
  const resultado = puedeReservar(solicitud, reservas, config, fechaHoy());
  if (!resultado.ok) {
    setEstado({
      solicitud,
      aviso: { tipo: 'aviso', mensaje: resultado.motivo, accion: 'cambiar-fecha' },
    });
    return;
  }

  const reserva = {
    codigo: generarCodigo(),
    fecha: solicitud.fecha,
    turno: solicitud.turno,
    personas: solicitud.personas,
    nombre,
    telefono: normalizarTelefono(telefono),
    mesaId: resultado.mesaAsignada.id,
    creadaEl: fechaHoy(),
  };

  if (!guardarReservas([...reservas, reserva])) {
    setEstado({
      solicitud,
      aviso: {
        tipo: 'error',
        mensaje: 'No pudimos guardar la reserva en este navegador. Libera espacio o llámanos al +56 41 234 5678.',
      },
    });
    return;
  }

  setEstado({
    solicitud: { ...solicitud, nombre, telefono },
    ticket: { ...reserva, capacidad: resultado.mesaAsignada.capacidad },
    aviso: null,
  });
}

/* ============================================================
   Utilidades
   ============================================================ */

// Código corto legible: 6 símbolos de un alfabeto sin caracteres ambiguos,
// elegidos con crypto.getRandomValues. Muestreo por rechazo: un byte va de
// 0 a 255 y 256 no es múltiplo de 31, así que `byte % 31` favorecería a los
// primeros símbolos; descartamos los bytes >= 248 (= 31 × 8) para que
// todos los símbolos salgan con la misma probabilidad.
function generarCodigo() {
  const limite = 256 - (256 % ALFABETO_CODIGO.length);
  let codigo = '';

  while (codigo.length < LARGO_CODIGO) {
    const bytes = crypto.getRandomValues(new Uint8Array(LARGO_CODIGO * 2));
    for (const byte of bytes) {
      if (byte < limite && codigo.length < LARGO_CODIGO) {
        codigo += ALFABETO_CODIGO[byte % ALFABETO_CODIGO.length];
      }
    }
  }
  return codigo;
}

// Guardamos el teléfono en un único formato canónico (+56 9 1234 5678),
// acepte lo que acepte el input.
function normalizarTelefono(telefono) {
  const digitos = telefono.replace(/\D/g, '').replace(/^56/, '');
  return `+56 9 ${digitos.slice(1, 5)} ${digitos.slice(5, 9)}`;
}

// "2026-06-13" → "sábado 13 de junio de 2026" (nombreDia viene de fechas.js).
function fechaLegible(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return `${nombreDia(fecha)} ${dia} de ${NOMBRES_MESES[mes - 1]} de ${anio}`;
}

function etiquetaTurno(turnoId) {
  return turnoId.charAt(0).toUpperCase() + turnoId.slice(1);
}

function horaTurno(turnoId) {
  return config.turnos.find((t) => t.id === turnoId)?.hora ?? '';
}

function capacidadMaxima() {
  return config.mesas.reduce((max, mesa) => Math.max(max, mesa.capacidad), 0);
}

// ['lunes'] → "lunes"; ['lunes', 'martes'] → "lunes y martes".
function listaEnEspanol(items) {
  if (items.length <= 1) {
    return items.join('');
  }
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

// Todo dato que viaja del usuario (o del JSON) al innerHTML pasa por aquí.
function escaparHtml(texto) {
  const reemplazos = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(texto).replace(/[&<>"']/g, (caracter) => reemplazos[caracter]);
}

iniciar();
