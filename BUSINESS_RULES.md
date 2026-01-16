# Reglas de Negocio y Lógica del Sistema - Truequealo.pe

Este documento consolida las reglas vigentes (actualizado al 27/12/2025).

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
- Teléfono: solo formato (regex, 9 dígitos Perú). No hay verificación SMS.

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
- Elegir "Permuta" limpia Dinero/Regalo.
- Elegir "Regalo" limpia todo.
- Artículo y Servicio pueden convivir (trueque mixto).
- En Permuta, el vendedor solo ingresa **precio referencial total**; se muestra ayuda aclaratoria.
- Categoría **“Otros”**: obliga a describir la categoría en texto (`otherCategoryLabel`) tanto al crear como al editar.

## 7. Contacto y ofertas (detalle de producto)
- **Venta**: el mensaje de WhatsApp indica que el comprador quiere pagar el precio completo.
- **Trueque**: el interesado debe escribir qué ofrece antes de abrir WhatsApp; el mensaje se personaliza con su texto.
- **Permuta**: el interesado debe ingresar producto/servicio ofrecido y monto; ambos van en el mensaje. Antes de abrir WhatsApp se registra la oferta.
- **Tooltip**: en Permuta se muestra ayuda al lado del precio explicando "Precio referencial total".

## 8. Métricas y ofertas en Firestore
- **Clicks de contacto**: `products/{productId}/contactLogs` con `{ userId, sellerId, channel, createdAt }` (canal `whatsapp`, `instagram`, `other`). Lectura autenticada; creación por usuarios autenticados para ese producto.
- **Ofertas de permuta**: `products/{productId}/offers` con `{ userId, sellerId, productId, itemOffer, cashOffer, type: "permuta", createdAt }`. Lectura: vendedor o autor; creación: usuario autenticado y dueño del click.
- **Órdenes**: `orders/{orderId}` almacena la reserva (status `pending`) y referencia al comprador/vendedor/producto. En el producto se actualizan `reservedForUserId`/`reservedForContact` al crear, y `finalBuyerUserId`/`finalBuyerContact`/`finalDealPrice` al confirmar.

## 9. Publicación (formulario)
- Imágenes obligatorias para productos.
- Condición obligatoria para productos.
- En Permuta ya no se ingresa "monto diferencial"; solo precio referencial total. Los campos "qué buscas" son requeridos según tipo de intercambio.
- Categoría “Otros” obliga a capturar `otherCategoryLabel` (texto libre).

## 10. Cierre de operaciones (dashboard vendedor)
- Asignación de persona por **correo** (no se usa teléfono) antes de cerrar; se verifica contra colección `users`.
- Al marcar **sold** se abre modal según tipo:
  - Venta/Donación: pide solo correo.
  - Trueque: pide correo + producto/servicio entregado.
  - Permuta: pide correo + producto/servicio entregado + monto de diferencia pagado.
- Se registran en el producto los campos finales: `finalBuyerUserId`, `finalBuyerContact`, `finalDealPrice`, `finalDealItems`, `finalizedAt`. El estado pasa a `sold` y se muestra el resumen en historial y en el detalle del producto (para el vendedor).
