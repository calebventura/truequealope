# Especificaciones: Release 1.1 - Mejoras de UX

## 1. Previsualización y Gestión de Imágenes (Creación/Edición)

**Requerimiento:** Ver y gestionar las imágenes seleccionadas antes de subirlas.

- **Solución Implementada:**
  - **Previsualización:** Al seleccionar archivos, se generan URLs locales (`URL.createObjectURL`) y se muestran en una grilla.
  - **Gestión:** Botón "X" en cada thumbnail para eliminar imágenes individualmente de la selección.
  - **Zoom (Lightbox):** Al hacer click en una miniatura, se abre un modal con la imagen ampliada.
    - Cierre mediante botón "X" flotante o click en el fondo.
  - **Móvil:** Interfaz optimizada para tacto, botones de eliminación siempre visibles.

## 2. Ubicación Estandarizada

**Requerimiento:** Selección estructurada de ubicación para Lima y Arequipa.

- **Solución Implementada:**
  - **Datos:** Estructura definida en `src/lib/locations.ts` con departamentos y sus distritos.
  - **UI:** Selectores dependientes (Cascading Dropdowns).
    1.  **Departamento:** Selección inicial (Lima, Arequipa).
    2.  **Distrito:** Se habilita y puebla basado en el departamento seleccionado.
  - **Persistencia:** Se guarda como string `"Distrito, Departamento"` para compatibilidad, y se parsea al editar.

## 3. Mejora de Visualización en Listados (Dashboard/Search)

**Requerimiento:** Mejorar la experiencia de navegación de productos con múltiples imágenes.

- **Solución Implementada:**
  - **Carrusel de Imágenes:** Componente `ImageCarousel` para items con > 1 imagen.
  - **Navegación:**
    - Flechas laterales (Desktop: visibles al hover / Móvil: ocultas).
    - Deslizamiento (Swipe) nativo para móviles.
    - Indicadores (Dots) interactivos con lógica de ventana deslizante (máx 5 visibles).
  - **UX Móvil:**
    - Flechas ocultas para limpieza visual.
    - Puntos de navegación con área de contacto ampliada para fácil interacción táctil.
    - Navegación infinita (loop).

## Estado
- [x] Implementado y Validado.
