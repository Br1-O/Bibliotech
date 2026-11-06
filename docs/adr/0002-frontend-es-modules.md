# ADR 0002: Migrar el frontend a ES modules sin build step

- Estado: aceptado
- Fecha: 2026-11-05
- Actualizado: 2026-11-06

## Contexto

Las paginas cargaban decenas de etiquetas `<script>` en un orden fragil. Los
componentes y controladores declaraban globals implicitos, de modo que mover un
archivo o cambiar el orden podia romper una pantalla. El proyecto no tiene
bundler ni framework y debe seguir sirviendose como sitio estatico.

## Decision

- `frontend/js/bootstrap.js` es el unico punto de entrada de aplicacion y se
  carga con `<script type="module">` en todas las paginas.
- Cada utilidad, componente y controlador usa `import`/`export` explicitos.
- No se usan puentes `globalThis` para la API de los modulos. Las dependencias
  se importan directamente; `tagInput` exporta `attachTagInput` y `theme`
  exporta `Theme`.
- `frontend/js/theme-init.js` sigue siendo un script clasico minimo en el
  `<head>` para aplicar el tema antes del primer render y evitar FOUC.
- `tests.html` conserva scripts clasicos porque su runner construye un sandbox
  con `vm` en Node.
- El orden de carga lo resuelve el grafo de imports, no el orden de etiquetas.

## Consecuencias

- El grafo de dependencias es explicito y verificable en CI.
- No se requiere compilador, bundler ni cambios de despliegue.
- Un fallo de importacion afecta toda la pagina, por lo que el chequeo de modulos
  y el smoke test son obligatorios.
- El codigo nuevo debe importar lo que usa; agregar globals ya no es aceptado.

## Verificacion

`npm run check:modules` enlaza y evalua 34 modulos con stubs de DOM, detecta
globals implicitos y verifica los eventos `bt:ready`/`DOMContentLoaded`. Se
probaron las paginas principales en Firefox headless sin errores de consola.
