// js/fechas.js
// Utilidades de fechas. Trabajamos SIEMPRE con strings "YYYY-MM-DD"
// construidos con la fecha LOCAL, nunca con toISOString().
//
// Lección del proyecto de hábitos: toISOString() convierte a UTC,
// y en Chile (UTC-3 / UTC-4) eso significa que entre las 21:00 y las
// 00:00 la fecha "salta" al día siguiente. new Date().getDate() y
// compañía usan la hora local, que es la que vive el comensal.

const NOMBRES_DIAS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

// Convierte un objeto Date a "YYYY-MM-DD" usando los componentes locales.
function formatearFecha(fechaObj) {
  const anio = fechaObj.getFullYear();
  const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
  const dia = String(fechaObj.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// Convierte "YYYY-MM-DD" a un objeto Date LOCAL.
// Ojo: new Date("2026-06-11") interpreta el string como UTC (medianoche UTC),
// por eso desarmamos el string y usamos el constructor numérico, que es local.
function aFechaLocal(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

// Fecha de hoy en formato "YYYY-MM-DD", según el reloj local.
function fechaHoy() {
  return formatearFecha(new Date());
}

// Nombre del día de la semana en español para una fecha "YYYY-MM-DD".
function nombreDia(fecha) {
  return NOMBRES_DIAS[aFechaLocal(fecha).getDay()];
}

// ¿La fecha `a` es anterior a la fecha `b`?
// Con el formato YYYY-MM-DD el orden alfabético coincide con el
// cronológico ("2026-06-09" < "2026-06-10"), así que basta comparar strings.
function esAnterior(a, b) {
  return a < b;
}

// Suma `dias` a una fecha "YYYY-MM-DD" y devuelve otro string "YYYY-MM-DD".
// El constructor de Date normaliza los desbordes (31 de junio → 1 de julio).
function sumarDias(fecha, dias) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return formatearFecha(new Date(anio, mes - 1, dia + dias));
}
