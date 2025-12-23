# Especificaciones: Release 1.1 - Mejoras de UX

## 1. Previsualización de Imágenes

**Requerimiento:** Ver las imágenes seleccionadas antes de subirlas al servidor.

- **Problema Actual:** Las imágenes se suben directamente o no se ve feedback visual claro hasta el final (dependiendo de la implementación actual).
- **Solución:**
  - Al seleccionar archivos (`input type="file"`), generar URLs locales con `URL.createObjectURL()`.
  - Mostrar grid de thumbnails.
  - Botón "X" en cada thumbnail para remover de la selección antes de subir.
  - Subida real ocurre al dar click en "Publicar" (o mantener lógica actual si ya sube al final, pero visualizando antes).

## 2. Ubicación Estandarizada

**Requerimiento:** Lista desplegable de distritos de Lima y Arequipa (Provincias principales).

- **Datos:**
  - Crear estructura de datos en `src/lib/locations.ts` (o `constants.ts`).
  - `LIMA_DISTRICTS`: ["Miraflores", "San Isidro", "Lima Cercado", ...]
  - `AREQUIPA_DISTRICTS`: ["Arequipa", "Yanahuara", "Cayma", ...]
- **UI (`products/new` y `edit`):**
  - Reemplazar input texto `location` por:
    1.  Select `Departamento`: [Lima, Arequipa, Otro].
    2.  Select `Distrito`: (Se llena según departamento).
    3.  Si es "Otro", permitir input texto libre o deshabilitar por ahora (según alcance, asumiremos foco en Lima/Arequipa).

## Plan de Ejecución

1.  Crear lista de distritos.
2.  Modificar componente de formulario en `products/new` para implementar la lógica de previsualización de imágenes.
3.  Reemplazar campo de ubicación con los selectores anidados.
