# Roadmap de Desarrollo - Reutilizalope

Este documento describe el plan de implementación para las nuevas funcionalidades solicitadas.

## Estructura de Releases

### [Release 1.0: Nuevos Modelos de Negocio](./release-1.0-business-model/SPECS.md)

**Enfoque:** Ampliación de tipos de transacción y categorías.

- Nueva Categoría: "Regalo de mi ex".
- Nuevos Modos: Permuta (Intercambio + Dinero) y Regalo (Gratis).
- Nuevo Tipo de Item: Servicios (además de Productos).

### [Release 1.1: Mejoras de UX (Imágenes y Ubicación)](./release-1.1-ux-improvements/SPECS.md)

**Enfoque:** Usabilidad en la creación de publicaciones.

- [x] Previsualización de imágenes antes de subir.
- [x] Selección estandarizada de ubicación (Distritos de Lima y Arequipa).
- [x] Carrusel de imágenes en listados (Dashboard/Search).

### [Release 1.2: Flujo de Publicación sin Fricción](./release-1.2-auth-flow/SPECS.md)

**Enfoque:** Retención de usuarios no logueados.

- Permitir iniciar el llenado del formulario sin sesión.
- Persistencia de datos (Draft) durante el flujo de login/registro.
- Restauración automática de datos al volver.

---

**Estado Actual:** Release 1.1 Completado. Listo para iniciar Release 1.2.
