# Reglas de Negocio y Lógica del Sistema - Truequealo.pe

Este documento consolida las reglas vigentes (actualizado al 28/01/2026).

## 1. Ciclo de Vida del Producto y Compra

### Estados del Producto
- **`active`**: visible y disponible.
- **`reserved`**: alguien inició intención de compra; bloqueado para otros.
- **`sold`**: transacción confirmada.
- **`deleted`**: borrado lógico; no visible en listados públicos.

### Flujo de transacción
1) **Intención de compra**: valida estado; pasa a `reserved`; crea orden `pending` y guarda `reservedForUserId` + `reservedForContact` (correo del comprador si existe perfil).
2) **Confirmación vendedor**: acepta → producto `sold`, orden `completed`, fija `finalBuyerUserId`, `finalBuyerContact`, `finalDealPrice`, `finalizedAt`. Rechaza → producto `active`, orden `cancelled`.
3) **Expiración de reserva**: configurable (`NEXT_PUBLIC_RESERVATION_TIME_MINUTES`). Si expiró, otro comprador puede reservar y la reserva previa se invalida.

## 2. Visibilidad
- Vendidos se muestran 24h con baja prioridad; siempre visibles para el vendedor.
- Reservados se muestran con indicador/acción deshabilitada.

## 3. Edición de productos
- Permitida en `active` y `reserved`.
- Si está `reserved` y se edita, el comprador debe ver alerta/badge en su detalle de orden (pendiente implementación de aviso).

## 4. Validaciones de usuario
- Teléfono: formato Perú de 9 dígitos (regex). No hay verificación SMS.
- Instagram: `@usuario` válido (solo letras/números/puntos/guiones bajos, sin espacios).
- **Contacto obligatorio**: en registro y edición de perfil debe existir al menos uno: teléfono o Instagram. Si se registra con Google, debe completar los datos faltantes antes de continuar usando la app.
- Perfil requiere ubicación (departamento, provincia, distrito) usando el dataset nacional (Lima, Arequipa y Callao priorizados en listas).

## 5. Gestión del vendedor
- Dashboard con “Solicitudes Pendientes” para aceptar/rechazar reservas.

## 6. Tipos de intercambio y publicación

| Opción | Definición | Reglas | Datos requeridos |
| --- | --- | --- | --- |
| **💰 Dinero** | Venta pura. | Exclusivo. | `price` (valor total). |
| **🧱 Artículo** | Trueque objeto↔objeto. | Compatible con Servicio; incompatible con Dinero/Permuta/Regalo. | `wantedProducts` (qué busca). |
| **🛠️ Servicio** | Trueque servicio↔servicio. | Compatible con Artículo; incompatible con Dinero/Permuta/Regalo. | `wantedServices` (qué busca). |
| **🔄 Permuta** | Objeto/Servicio + dinero ofrecido por el comprador. | Exclusivo. El vendedor fija **precio referencial total**; el comprador debe proponer producto/servicio + monto. | `price` (valor referencial total), al menos uno de `wantedProducts`/`wantedServices`. |
| **🎁 Regalo** | Donación. | Exclusivo con todas. | Ninguno (precio 0 implícito). |

**Reglas de interfaz (publicación)**:
- Wizard de 3 pasos: el paso 3 (ubicación y detalles finales) solo se publica con click explícito en **Publicar**; avanzar de paso nunca dispara publicación.
- Descripción del anuncio es **obligatoria** (mínimo 15 caracteres, máximo 2000).
- Dirección: departamento/provincia/distrito requeridos; se autocompletan con la ubicación del perfil si existe, pero deben quedar seleccionados. Selects dependientes (provincia filtra distritos).
- Elegir "Permuta" limpia Dinero/Regalo. Elegir "Regalo" limpia todo. Artículo y Servicio pueden convivir (trueque mixto).
- En Permuta, el vendedor solo ingresa **precio referencial total**; se muestra ayuda aclaratoria.
- Categoría **“Otros”**: obliga a describir la categoría en texto (`otherCategoryLabel`) tanto al crear como al editar.

## 7. Contacto y ofertas (detalle de producto)
- **Autenticación requerida**: todos los botones de contacto (WhatsApp e Instagram) requieren sesión activa. Si el usuario no está logueado, se redirige a `/auth/login?next=/products/{id}` y al completar el login vuelve al producto.
- **Venta**: el mensaje de WhatsApp indica que el comprador quiere pagar el precio completo.
- **Trueque**: el interesado debe escribir qué ofrece antes de abrir WhatsApp; el mensaje se personaliza con su texto.
- **Permuta**: el interesado debe ingresar producto/servicio ofrecido y monto; ambos van en el mensaje. Antes de abrir WhatsApp se registra la oferta.
- **Link del producto**: todos los mensajes de WhatsApp incluyen automáticamente el link directo al producto (`{origin}/products/{id}`), tanto en la página de detalle como en la sección de actividad.
- **"Busco a cambio"**: cuando el vendedor especificó qué busca a cambio, esta información se muestra siempre en el detalle del producto, independientemente de si el interesado seleccionó "Pagar precio" u "Ofrecer trueque". Es información del producto, no de la acción del comprador.
- **Tooltip**: en Permuta se muestra ayuda al lado del precio explicando "Precio referencial total".
- Botones de contacto visibles según datos del vendedor: si no hay teléfono, solo Instagram; si hay ambos, se muestran ambos botones.

## 8. Métricas y ofertas en Firestore
- **Clicks de contacto**: `products/{productId}/contactLogs` con `{ userId, sellerId, channel, createdAt }` (canal `whatsapp`, `instagram`, `other`). Lectura autenticada; creación por usuarios autenticados para ese producto.
- **Ofertas de permuta**: `products/{productId}/offers` con `{ userId, sellerId, productId, itemOffer, cashOffer, type: "permuta", createdAt }`. Lectura: vendedor o autor; creación: usuario autenticado y dueño del click.
- **Órdenes**: `orders/{orderId}` almacena la reserva (status `pending`) y referencia al comprador/vendedor/producto. En el producto se actualizan `reservedForUserId`/`reservedForContact` al crear, y `finalBuyerUserId`/`finalBuyerContact`/`finalDealPrice` al confirmar.

## 9. Publicación (formulario)
- Imágenes obligatorias para productos.
- Condición obligatoria para productos.
- Descripción obligatoria (15-2000 caracteres).
- En Permuta ya no se ingresa "monto diferencial"; solo precio referencial total. Los campos "qué buscas" son requeridos según tipo de intercambio.
- Categoría “Otros” obliga a capturar `otherCategoryLabel` (texto libre).
- Ubicación requerida (departamento, provincia, distrito). Dataset completo Perú (prioriza Lima/Arequipa/Callao en la lista). Distrito se filtra por provincia.
- Los selects de ubicación no muestran alertas hasta que el usuario intenta publicar; el mensaje de error aparece al validar el paso 3.
- Se precarga la ubicación del perfil en nuevas publicaciones.

## 10. Cierre de operaciones (dashboard vendedor)
- Asignación de persona por **correo** (no se usa teléfono) antes de cerrar; se verifica contra colección `users`.
- Al marcar **sold** se abre modal según tipo:
  - Venta/Donación: pide solo correo.
  - Trueque: pide correo + producto/servicio entregado.
  - Permuta: pide correo + producto/servicio entregado + monto de diferencia pagado.
- Se registran en el producto los campos finales: `finalBuyerUserId`, `finalBuyerContact`, `finalDealPrice`, `finalDealItems`, `finalizedAt`. El estado pasa a `sold` y se muestra el resumen en historial y en el detalle del producto (para el vendedor).

## 11. Datos geográficos
- Fuente: `docs/locations.json` generado desde el dataset nacional de distritos (incluye Callao). Listas priorizan Lima, Arequipa y Callao.
- Helpers: `LOCATIONS`, `PROVINCES_BY_DEPARTMENT`, `getDistrictsFor` y normalizadores en `src/lib/locations.ts`.
- El detalle del producto muestra la ubicación declarada del anuncio debajo del título.

## 12. Búsqueda y exploración
- El buscador de `/search` solo filtra al presionar **Buscar** (clic o Enter); no filtra por carácter para evitar parpadeos.
- **Ordenamiento**: tanto en Home (`/`) como en Search (`/search`) hay un selector "Ordenar" con las opciones:
  - **Más recientes** (default): por fecha de creación descendente.
  - **Más populares**: por cantidad de vistas descendente.
  - **Menor precio**: precio ascendente (productos sin precio al final).
  - **Mayor precio**: precio descendente (productos sin precio al final).
- El ordenamiento se persiste en la URL con `?sort=newest|popular|price_asc|price_desc`, permitiendo compartir búsquedas ordenadas. El valor por defecto (`newest`) no se incluye en la URL para mantenerla limpia.
- Paginación en cliente: botón **Mostrar más** en home y search. Tamaño por defecto 12 (configurable vía `NEXT_PUBLIC_PAGE_SIZE_EXPLORE`).
- Dashboard vendedor: paginación con selector 10/12/20/50 (default 20; `NEXT_PUBLIC_PAGE_SIZE_DASHBOARD`).

## 13. Compatibilidad entre navegadores
- **Formato numérico y de fechas**: todos los `toLocaleString()` y `toLocaleDateString()` especifican locale `"es-PE"` para garantizar formato consistente entre Chrome y Safari.
- **localStorage**: todos los accesos están envueltos en `try-catch` para soportar Safari en modo de navegación privada, donde `localStorage` puede lanzar excepciones.
- **scrollIntoView**: usa fallback cuando `behavior: 'smooth'` no es soportado (Safari antiguo).
- **Clipboard API**: el botón compartir usa `try-catch` con fallback a `window.prompt` si el navegador no soporta `navigator.clipboard`.
