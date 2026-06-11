# La Mesa del Bío Bío — Sistema de reservas

Sistema de reservas para un restaurante ficticio de Concepción.
Proyecto de práctica en JavaScript vanilla, sin frameworks ni build.

## Estado: Fase A (lógica, sin interfaz)

En esta fase existe la configuración, el modelo de dominio y el motor de
reglas con su suite de tests. La interfaz llega después. En la Fase B,
`js/storage.js` se reemplaza por llamadas a la API de un backend.

## Estructura

```
index.html        Esqueleto semántico (se llena en la fase de UI)
css/styles.css    Solo design tokens (:root) — paleta cálida y sobria
data/config.json  Configuración del restaurante: mesas, turnos, días cerrados
js/fechas.js      Fechas locales YYYY-MM-DD (sin trampas de UTC)
js/reglas.js      Motor de reglas: SOLO funciones puras — el negocio vive aquí
js/storage.js     Persistencia en localStorage (interfaz cargar/guardar)
tests.html        Corredor de tests: abrir en el navegador
js/tests.js       Suite de tests del motor de reglas
```

## Reglas de negocio

- 8 mesas con capacidades 2, 2, 2, 4, 4, 4, 6 y 8.
- Dos turnos por día: almuerzo (13:00) y cena (20:00).
- Cerrado los lunes.
- Se reserva con máximo 30 días de anticipación; hoy mismo es válido.
- A cada grupo se le asigna la mesa **más chica** cuya capacidad alcance,
  para dejar las mesas grandes libres para los grupos grandes.
- Una mesa puede tener una reserva por turno: misma mesa, mismo día,
  turnos distintos **no** colisionan.

## Cómo correr los tests

Abrir `tests.html` en el navegador. Cada test se pinta en verde (pasa)
o rojo (falla) y al final se muestra el resumen "X de Y tests pasando".

Los tests fijan su propio "hoy" (2026-06-11) y su propia configuración,
por lo que dan el mismo resultado cualquier día que se corran.
