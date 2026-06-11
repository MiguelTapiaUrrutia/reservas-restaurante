// js/storage.js
// Persistencia de reservas en localStorage.
//
// Fase B: este módulo se reemplaza por llamadas a la API del backend.
// Por eso la interfaz es deliberadamente chica (cargar/guardar): el resto
// de la app no sabe ni le importa DÓNDE viven las reservas. El día que
// exista el backend, solo cambia el cuerpo de estas dos funciones.

const CLAVE_RESERVAS = 'la-mesa-biobio:reservas';

// Devuelve el array de reservas guardado, o [] si no hay nada
// o si lo guardado está corrupto (no es JSON válido o no es un array).
function cargarReservas() {
  const crudo = localStorage.getItem(CLAVE_RESERVAS);
  if (crudo === null) {
    return [];
  }

  try {
    const datos = JSON.parse(crudo);
    if (!Array.isArray(datos)) {
      console.warn('storage: lo guardado no es un array de reservas, se descarta.');
      return [];
    }
    return datos;
  } catch (error) {
    console.warn('storage: JSON corrupto en localStorage, se descarta.', error);
    return [];
  }
}

// Guarda el array completo de reservas. Devuelve true si pudo guardar.
function guardarReservas(reservas) {
  try {
    localStorage.setItem(CLAVE_RESERVAS, JSON.stringify(reservas));
    return true;
  } catch (error) {
    console.error('storage: no se pudo guardar (¿cuota llena?).', error);
    return false;
  }
}
