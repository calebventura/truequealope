# Especificaciones: Release 1.0 - Nuevos Modelos de Negocio

## 1. Categoría "Regalo de mi ex"

**Requerimiento:** Crear una categoría llamativa para artículos de ex-parejas.

- **Acción:** Agregar a `CATEGORIES` en `src/lib/constants.ts`.
- **ID:** `ex-gift` (o similar).
- **Icono:** 💔 (Corazón roto) o 🎁 (Regalo).

## 2. Nuevos Modos de Transacción y "Lo que busco"

**Requerimiento:** Soportar Permuta, Regalo y especificar qué busca el vendedor (Dinero, Producto, Servicio).

- **Actual:** `sale` (Venta), `trade` (Trueque), `both`.
- **Nuevos Modos / Intenciones:**
  - El vendedor debe poder marcar qué acepta:
    1.  **Dinero** (Venta pura).
    2.  **Producto** (Trueque por otro objeto).
    3.  **Servicio** (Intercambio por un servicio).
    4.  **Permuta** (Combinación: Objeto/Servicio + Diferencia en dinero).
    5.  **Regalo** (Sin contraprestación).
- **Cambios en Código:**
  - Actualizar `ProductMode` en `src/types/product.ts` o agregar campo `acceptedExchangeTypes`: `('money' | 'product' | 'service')[]`.
  - Manejo especial para "Permuta" (requiere campo de monto diferencial aproximado) y "Regalo" (precio 0).
  - Actualizar lógica de validación en `src/app/products/new/page.tsx`.
    - Si selecciona "Busco Servicio", el campo de "Qué buscas" debe sugerir servicios.

## 3. Intercambio de Servicios

**Requerimiento:** Permitir ofrecer servicios, no solo productos físicos.

- **Cambios en Modelo:**
  - Agregar campo `listingType` a la interfaz `Product`: `'product' | 'service'`.
- **Cambios en UI (`products/new`):**
  - Switch o Tabs al inicio del formulario: "¿Qué publicas? [Producto] [Servicio]".
  - Si es Servicio:
    - Ocultar campo "Condición" (Nuevo/Usado).
    - Adaptar labels (ej. "Título del servicio" en vez de "Nombre del producto").

## Plan de Ejecución

1.  Modificar `src/types/product.ts` para incluir nuevos tipos y modos.
2.  Actualizar `src/lib/constants.ts` con la nueva categoría.
3.  Refactorizar `src/app/products/new/page.tsx` para manejar la lógica condicional de los nuevos campos.
4.  Actualizar `src/app/products/[id]/page.tsx` para mostrar correctamente la info (ej. si es regalo, mostrar "GRATIS").
