// js/seed.js — modo demo para presentaciones.
//
// PARÁMETRO DE URL: abrir el sitio con ?demo=1 (ej. index.html?demo=1)
// siembra 7-8 reservas ficticias en localStorage para poder mostrar el
// wizard con datos realistas. La cena del primer día abierto queda CASI
// llena a propósito: solo sobreviven mesas de 2, así que pedir mesa para
// 3 o más personas esa noche dispara el aviso "sin mesa" en vivo.
//
// Salvaguardas:
//   - Solo actúa si la URL trae exactamente demo=1.
//   - Solo actúa si NO hay reservas guardadas: jamás pisa datos reales.
//   - Las reservas sembradas llevan esDemo: true para distinguirlas.
//
// Para limpiar la demo: localStorage.removeItem('la-mesa-biobio:reservas')
// en la consola, o borrar los datos del sitio.
//
// Script clásico (como fechas/reglas/storage): usa sus funciones globales.
// Lo invoca wizard.js tras cargar la configuración.

const NOMBRES_DEMO = [
  'Carmen Riquelme',
  'Patricio Sanhueza',
  'Valentina Huenchumán',
  'Rodrigo Matamala',
  'Sofía Llanos',
  'Héctor Painequeo',
  'Daniela Bustos',
  'Marcelo Ñanco',
];

const TELEFONOS_DEMO = [
  '+56 9 7214 8635',
  '+56 9 8423 1907',
  '+56 9 6138 4572',
  '+56 9 9356 2841',
  '+56 9 7782 5316',
  '+56 9 8541 6293',
  '+56 9 6927 3458',
  '+56 9 9163 7524',
];

// Códigos fijos con el mismo alfabeto sin ambiguos del wizard.
const CODIGOS_DEMO = ['XQ72MT', 'WJ94KP', 'RD83NV', 'TZ65HB', 'GM27QF', 'PK58WD', 'HN39RZ', 'VB46TJ'];

// Punto de entrada. Devuelve true si sembró datos.
function sembrarDatosDemo(config) {
  // location.search es el query string crudo ("?demo=1&otra=x");
  // URLSearchParams lo parsea (separadores, decodificación) y permite
  // preguntar por clave sin andar partiendo strings a mano.
  const parametros = new URLSearchParams(window.location.search);
  if (parametros.get('demo') !== '1') {
    return false;
  }

  if (cargarReservas().length > 0) {
    console.info('seed: ya hay reservas guardadas; el modo demo no las pisa.');
    return false;
  }

  const reservas = construirReservasDemo(config);
  if (!guardarReservas(reservas)) {
    return false;
  }

  mostrarAvisoDemo();
  return true;
}

// Arma el plan de reservas a partir de config (no hardcodea mesas ni turnos).
function construirReservasDemo(config) {
  const hoy = fechaHoy();

  // Días abiertos dentro de los próximos 5 (saltando los de cierre).
  const fechasAbiertas = [];
  for (let i = 1; i <= 5; i++) {
    const fecha = sumarDias(hoy, i);
    if (!config.diasCerrado.includes(nombreDia(fecha))) {
      fechasAbiertas.push(fecha);
    }
  }

  const [diaLleno, ...otrosDias] = fechasAbiertas;
  const almuerzo = config.turnos[0].id;
  const cena = config.turnos[1].id;
  const mesasChicas = config.mesas.filter((m) => m.capacidad <= 2);
  const mesasGrandes = config.mesas.filter((m) => m.capacidad > 2);

  const reservas = [];
  const agregar = (fecha, turno, mesa, personas) => {
    const n = reservas.length;
    reservas.push({
      codigo: CODIGOS_DEMO[n],
      fecha,
      turno,
      personas,
      nombre: NOMBRES_DEMO[n],
      telefono: TELEFONOS_DEMO[n],
      mesaId: mesa.id,
      creadaEl: hoy,
      esDemo: true,
    });
  };

  // 1) Cena de `diaLleno` casi llena: una mesa chica + TODAS las grandes.
  //    Quedan libres solo mesas de 2 → un grupo de 3+ esa noche es rechazado.
  agregar(diaLleno, cena, mesasChicas[0], 2);
  mesasGrandes.forEach((mesa) => {
    agregar(diaLleno, cena, mesa, Math.max(2, mesa.capacidad - 1));
  });

  // 2) El resto, repartido para que el calendario se vea vivo.
  agregar(diaLleno, almuerzo, mesasGrandes[0], 4);
  if (otrosDias.length > 0) {
    agregar(otrosDias[0], cena, mesasChicas[1] ?? mesasChicas[0], 2);
  }

  return reservas;
}

// Aviso discreto sobre el wizard: icono + texto, nunca solo color (WCAG 1.4.1).
function mostrarAvisoDemo() {
  const wizard = document.getElementById('wizard');
  if (!wizard) {
    return;
  }

  const aviso = document.createElement('div');
  aviso.className = 'banner banner--demo';
  aviso.innerHTML =
    '<svg class="banner-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="12" cy="8" r="1" fill="currentColor"/></svg>' +
    '<p>Datos de demostración cargados.</p>';
  wizard.before(aviso);
}
