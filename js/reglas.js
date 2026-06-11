// js/reglas.js
// Motor de reglas de "La Mesa del Bío Bío".
//
// SOLO funciones puras: nada de DOM, nada de localStorage, nada de
// new Date() interno. Todo lo que cada función necesita (la fecha de hoy,
// la configuración, las reservas existentes) entra por parámetros.
// Misma entrada → misma salida, siempre. Eso es lo que las hace testeables.
//
// Depende de js/fechas.js (esAnterior, sumarDias, nombreDia).

// ¿Se puede reservar en esta fecha?
// Devuelve { valida, motivo } en vez de un boolean pelado: el formulario
// (Fase de UI) necesita DECIRLE al usuario por qué se rechazó su fecha,
// y esa explicación nace aquí, junto a la regla que la produce.
function esFechaValida(fecha, hoy, config) {
  if (esAnterior(fecha, hoy)) {
    return { valida: false, motivo: 'La fecha ya pasó.' };
  }

  const fechaLimite = sumarDias(hoy, config.anticipacionMaximaDias);
  if (esAnterior(fechaLimite, fecha)) {
    return {
      valida: false,
      motivo: `Solo aceptamos reservas con hasta ${config.anticipacionMaximaDias} días de anticipación.`,
    };
  }

  const dia = nombreDia(fecha);
  if (config.diasCerrado.includes(dia)) {
    return { valida: false, motivo: `El restaurante cierra los ${dia}.` };
  }

  return { valida: true, motivo: null };
}

// Mesas del restaurante que NO tienen reserva en esa fecha y turno.
// Una mesa puede atender almuerzo y cena el mismo día: la colisión
// solo existe cuando coinciden fecha Y turno.
function mesasDisponibles(fecha, turno, reservas, config) {
  const idsOcupadas = reservas
    .filter((r) => r.fecha === fecha && r.turno === turno)
    .map((r) => r.mesaId);

  return config.mesas.filter((mesa) => !idsOcupadas.includes(mesa.id));
}

// Elige la mesa MÁS CHICA cuya capacidad alcance para el grupo,
// o null si ninguna alcanza.
//
// ¿Por qué la más chica? Si un grupo de 2 se sienta en la mesa de 8,
// esa noche el restaurante rechaza al grupo de 8 que llegue después,
// aunque sobren mesas de 2. Asignar la mesa más ajustada deja las
// grandes libres para los grupos grandes: máxima ocupación posible.
function asignarMesa(personas, mesasLibres) {
  const suficientes = mesasLibres.filter((mesa) => mesa.capacidad >= personas);

  if (suficientes.length === 0) {
    return null;
  }

  return suficientes.reduce((masChica, mesa) =>
    mesa.capacidad < masChica.capacidad ? mesa : masChica
  );
}

// Orquesta todas las reglas para una solicitud { fecha, turno, personas }.
// Recibe `hoy` como cuarto parámetro (y no lo calcula adentro) para
// seguir siendo pura: los tests pueden fijar "hoy" y dar siempre
// el mismo resultado, hoy, mañana o en un año más.
//
// Devuelve:
//   { ok: true,  mesaAsignada: { id, capacidad } }
//   { ok: false, motivo: '...' }
function puedeReservar(solicitud, reservas, config, hoy) {
  const { fecha, turno, personas } = solicitud;

  if (!Number.isInteger(personas) || personas < 1) {
    return { ok: false, motivo: 'Indica cuántas personas vienen (mínimo 1).' };
  }

  const turnosValidos = config.turnos.map((t) => t.id);
  if (!turnosValidos.includes(turno)) {
    return { ok: false, motivo: `Turno desconocido: elige ${turnosValidos.join(' o ')}.` };
  }

  const resultadoFecha = esFechaValida(fecha, hoy, config);
  if (!resultadoFecha.valida) {
    return { ok: false, motivo: resultadoFecha.motivo };
  }

  const libres = mesasDisponibles(fecha, turno, reservas, config);
  const mesa = asignarMesa(personas, libres);

  if (mesa === null) {
    return { ok: false, motivo: motivoSinMesa(personas, libres, config) };
  }

  return { ok: true, mesaAsignada: mesa };
}

// Explica por qué no hubo mesa, distinguiendo los tres casos posibles.
function motivoSinMesa(personas, libres, config) {
  const capacidadMaxima = config.mesas.reduce(
    (max, mesa) => (mesa.capacidad > max ? mesa.capacidad : max),
    0
  );

  if (personas > capacidadMaxima) {
    return `No tenemos mesas para ${personas} personas (la más grande es de ${capacidadMaxima}).`;
  }
  if (libres.length === 0) {
    return 'No quedan mesas libres para ese turno.';
  }
  return `Las mesas para ${personas} personas ya están reservadas en ese turno.`;
}
