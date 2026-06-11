// js/tests.js
// Suite de tests del motor de reglas. Se ejecuta abriendo tests.html.
//
// Los tests NO usan fechaHoy() ni el config real cargado por fetch:
// fijan su propio "hoy" y su propio config. Así el resultado es el mismo
// hoy, mañana y en un año más (un test que pasa según el día en que lo
// corres no es un test, es una lotería).

// ---------------------------------------------------------------------------
// Mini framework: assert + resumen
// ---------------------------------------------------------------------------

const resultados = [];

function assert(descripcion, condicion) {
  resultados.push({ descripcion, paso: Boolean(condicion) });

  const item = document.createElement('li');
  item.textContent = `${condicion ? 'PASA' : 'FALLA'} — ${descripcion}`;
  item.className = condicion ? 'test-pasa' : 'test-falla';
  document.querySelector('#lista-tests').appendChild(item);
}

function pintarResumen() {
  const total = resultados.length;
  const pasando = resultados.filter((r) => r.paso).length;

  const resumen = document.querySelector('#resumen');
  resumen.textContent = `${pasando} de ${total} tests pasando`;
  resumen.className = pasando === total ? 'resumen-ok' : 'resumen-error';
}

// ---------------------------------------------------------------------------
// Datos fijos para los tests
// ---------------------------------------------------------------------------

// Espejo de data/config.json. Lo definimos acá (y no con fetch) para que
// los tests sean deterministas y corran incluso abriendo el archivo
// directo desde el disco.
const CONFIG_TEST = {
  nombre: 'La Mesa del Bío Bío',
  mesas: [
    { id: 'M1', capacidad: 2 },
    { id: 'M2', capacidad: 2 },
    { id: 'M3', capacidad: 2 },
    { id: 'M4', capacidad: 4 },
    { id: 'M5', capacidad: 4 },
    { id: 'M6', capacidad: 4 },
    { id: 'M7', capacidad: 6 },
    { id: 'M8', capacidad: 8 },
  ],
  turnos: [
    { id: 'almuerzo', hora: '13:00' },
    { id: 'cena', hora: '20:00' },
  ],
  diasCerrado: ['lunes'],
  anticipacionMaximaDias: 30,
};

// "Hoy" congelado: jueves 11 de junio de 2026.
// Desde aquí: 2026-06-15 es lunes (cerrado), 2026-07-11 es exactamente
// +30 días (sábado) y 2026-07-12 es +31 días.
const HOY = '2026-06-11';

// ---------------------------------------------------------------------------
// fechas.js
// ---------------------------------------------------------------------------

assert(
  'fechaHoy() devuelve un string con formato YYYY-MM-DD',
  /^\d{4}-\d{2}-\d{2}$/.test(fechaHoy())
);

assert('nombreDia("2026-06-15") es lunes', nombreDia('2026-06-15') === 'lunes');

assert(
  'esAnterior compara bien strings YYYY-MM-DD',
  esAnterior('2026-06-09', '2026-06-10') === true &&
    esAnterior('2026-06-10', '2026-06-10') === false
);

assert(
  'sumarDias cruza de mes correctamente (30 días desde el 11 de junio)',
  sumarDias('2026-06-11', 30) === '2026-07-11'
);

// ---------------------------------------------------------------------------
// esFechaValida: reglas de fecha y sus bordes
// ---------------------------------------------------------------------------

const fechaPasada = esFechaValida('2026-06-10', HOY, CONFIG_TEST);
assert(
  'fecha pasada se rechaza con motivo que lo explica',
  fechaPasada.valida === false && fechaPasada.motivo.includes('pasó')
);

const diaCerrado = esFechaValida('2026-06-15', HOY, CONFIG_TEST);
assert(
  'día cerrado (lunes) se rechaza con motivo que nombra el día',
  diaCerrado.valida === false && diaCerrado.motivo.includes('lunes')
);

assert(
  'fecha futura en día abierto es válida (viernes 2026-06-12)',
  esFechaValida('2026-06-12', HOY, CONFIG_TEST).valida === true
);

// Bordes: los límites exactos de cada regla.
assert(
  'BORDE: hoy mismo es válido (hoy no es "pasado")',
  esFechaValida(HOY, HOY, CONFIG_TEST).valida === true
);

assert(
  'BORDE: exactamente 30 días de anticipación es válido (2026-07-11)',
  esFechaValida('2026-07-11', HOY, CONFIG_TEST).valida === true
);

const dia31 = esFechaValida('2026-07-12', HOY, CONFIG_TEST);
assert(
  'BORDE: 31 días se rechaza por anticipación máxima',
  dia31.valida === false && dia31.motivo.includes('30')
);

// ---------------------------------------------------------------------------
// asignarMesa: la más chica que alcance
// ---------------------------------------------------------------------------

assert(
  'asignarMesa(3) elige una mesa de 4, no la de 6 ni la de 8',
  asignarMesa(3, CONFIG_TEST.mesas).capacidad === 4
);

assert(
  'asignarMesa(2) elige una mesa de 2 aunque haya más grandes libres',
  asignarMesa(2, CONFIG_TEST.mesas).capacidad === 2
);

assert(
  'BORDE: asignarMesa(8) ocupa justa la mesa de 8',
  asignarMesa(8, CONFIG_TEST.mesas).id === 'M8'
);

assert(
  'grupo de 9 se rechaza: ninguna mesa alcanza',
  asignarMesa(9, CONFIG_TEST.mesas) === null
);

assert(
  'asignarMesa con cero mesas libres devuelve null',
  asignarMesa(2, []) === null
);

// ---------------------------------------------------------------------------
// mesasDisponibles y colisiones
// ---------------------------------------------------------------------------

const reservaEnM1 = [
  { mesaId: 'M1', fecha: '2026-06-12', turno: 'cena', personas: 2 },
];

const libresViernes = mesasDisponibles('2026-06-12', 'cena', reservaEnM1, CONFIG_TEST);
assert(
  'colisión detectada: la mesa reservada no aparece como disponible',
  libresViernes.length === 7 && !libresViernes.some((m) => m.id === 'M1')
);

const libresAlmuerzo = mesasDisponibles('2026-06-12', 'almuerzo', reservaEnM1, CONFIG_TEST);
assert(
  'turno distinto NO colisiona: la misma mesa sirve almuerzo y cena',
  libresAlmuerzo.length === 8 && libresAlmuerzo.some((m) => m.id === 'M1')
);

const libresOtroDia = mesasDisponibles('2026-06-13', 'cena', reservaEnM1, CONFIG_TEST);
assert(
  'fecha distinta NO colisiona: mismo turno, otro día',
  libresOtroDia.some((m) => m.id === 'M1')
);

// ---------------------------------------------------------------------------
// puedeReservar: la orquesta completa
// ---------------------------------------------------------------------------

const solicitudValida = { fecha: '2026-06-12', turno: 'cena', personas: 5 };
const reservaOk = puedeReservar(solicitudValida, [], CONFIG_TEST, HOY);
assert(
  'puedeReservar acepta una solicitud válida y asigna la mesa de 6 para 5 personas',
  reservaOk.ok === true && reservaOk.mesaAsignada.id === 'M7'
);

const reservaLunes = puedeReservar(
  { fecha: '2026-06-15', turno: 'cena', personas: 2 },
  [],
  CONFIG_TEST,
  HOY
);
assert(
  'puedeReservar propaga el motivo de fecha inválida (lunes cerrado)',
  reservaLunes.ok === false && reservaLunes.motivo.includes('lunes')
);

// Las tres mesas de 2 ocupadas: el grupo de 2 sube a una mesa de 4.
const mesasDe2Ocupadas = [
  { mesaId: 'M1', fecha: '2026-06-12', turno: 'cena', personas: 2 },
  { mesaId: 'M2', fecha: '2026-06-12', turno: 'cena', personas: 2 },
  { mesaId: 'M3', fecha: '2026-06-12', turno: 'cena', personas: 2 },
];
const subeDeMesa = puedeReservar(
  { fecha: '2026-06-12', turno: 'cena', personas: 2 },
  mesasDe2Ocupadas,
  CONFIG_TEST,
  HOY
);
assert(
  'mesa ocupada no se reasigna: con las de 2 llenas, asigna una de 4',
  subeDeMesa.ok === true && subeDeMesa.mesaAsignada.capacidad === 4
);

// Todas las mesas ocupadas en ese turno.
const todasOcupadas = CONFIG_TEST.mesas.map((mesa) => ({
  mesaId: mesa.id,
  fecha: '2026-06-12',
  turno: 'cena',
  personas: 2,
}));
const sinMesas = puedeReservar(
  { fecha: '2026-06-12', turno: 'cena', personas: 2 },
  todasOcupadas,
  CONFIG_TEST,
  HOY
);
assert(
  'turno lleno: puedeReservar rechaza con motivo cuando no quedan mesas',
  sinMesas.ok === false && sinMesas.motivo.includes('No quedan mesas')
);

const grupoGigante = puedeReservar(
  { fecha: '2026-06-12', turno: 'cena', personas: 9 },
  [],
  CONFIG_TEST,
  HOY
);
assert(
  'grupo de 9 rechazado por puedeReservar con motivo de capacidad',
  grupoGigante.ok === false && grupoGigante.motivo.includes('9')
);

const turnoInvalido = puedeReservar(
  { fecha: '2026-06-12', turno: 'desayuno', personas: 2 },
  [],
  CONFIG_TEST,
  HOY
);
assert(
  'turno inexistente se rechaza con motivo',
  turnoInvalido.ok === false && turnoInvalido.motivo.includes('Turno')
);

// ---------------------------------------------------------------------------
// storage.js (guardamos y restauramos lo que hubiera para no pisar datos)
// ---------------------------------------------------------------------------

const respaldoStorage = localStorage.getItem(CLAVE_RESERVAS);

guardarReservas([{ mesaId: 'M1', fecha: '2026-06-12', turno: 'cena', personas: 2 }]);
const recuperadas = cargarReservas();
assert(
  'storage: guardar y cargar devuelve las mismas reservas',
  recuperadas.length === 1 && recuperadas[0].mesaId === 'M1'
);

localStorage.setItem(CLAVE_RESERVAS, '{esto no es JSON válido]');
assert(
  'storage: con datos corruptos devuelve [] en vez de explotar',
  Array.isArray(cargarReservas()) && cargarReservas().length === 0
);

if (respaldoStorage === null) {
  localStorage.removeItem(CLAVE_RESERVAS);
} else {
  localStorage.setItem(CLAVE_RESERVAS, respaldoStorage);
}

// ---------------------------------------------------------------------------

pintarResumen();
