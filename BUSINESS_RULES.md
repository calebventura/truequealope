# Reglas de Negocio y Lógica del Sistema - Truequealo.pe

Este documento define las reglas de negocio acordadas para el MVP, actualizadas al 23/12/2025.

## 1. Ciclo de Vida del Producto y Compra

### Estados del Producto

- **`active` (Activo):** Visible, disponible para compra.
- **`reserved` (Reservado):** Un comprador ha iniciado la intención de compra. Bloqueado temporalmente para otros.
- **`sold` (Vendido):** Transacción confirmada por el vendedor.
- **`deleted` (Eliminado):** Borrado lógico por el vendedor. No visible en listados públicos.

### Flujo de Transacción ("Compra")

1.  **Intención de Compra (Comprador):**

    - El comprador pulsa "Comprar".
    - **Validación:** El producto debe estar `active` O (`reserved` Y `expirado`).
    - **Acción:** El producto pasa a estado `reserved`. Se crea una Orden en estado `pending`.
    - **Bloqueo:** Otros usuarios no pueden iniciar transacción mientras esté vigente la reserva.

2.  **Confirmación (Vendedor):**

    - El vendedor ve la solicitud en "Solicitudes Pendientes".
    - **Acción:** Vendedor acepta -> Producto pasa a `sold`, Orden pasa a `completed`.

3.  **Rechazo (Vendedor):**

    - **Acción:** Vendedor rechaza -> Producto regresa a `active`, Orden pasa a `cancelled`.

4.  **Expiración de Reserva (Lazy Validation):**
    - **Configuración:** Tiempo definido por variable de entorno (ej. `NEXT_PUBLIC_RESERVATION_TIME_MINUTES`).
    - **Lógica:** Si un segundo comprador intenta comprar un producto `reserved` y `fecha_actual > fecha_reserva + tiempo_configurado`, el sistema permite la nueva compra, sobrescribiendo la reserva anterior (la anterior pasa a cancelada implícitamente o se marca explícitamente).

## 2. Visibilidad

- **Productos Vendidos (`sold`):**
  - Aparecen en el listado público con **baja prioridad**.
  - **Condición:** Solo visibles si se vendieron hace menos de **24 horas**.
  - Siempre visibles en el historial del vendedor.
- **Productos Reservados (`reserved`):**
  - Aparecen en el listado pero con indicativo de "En trato" o botón deshabilitado.

## 3. Edición de Productos

- **Permitido:** En estado `active` y `reserved`.
- **Alerta:** Si el producto está `reserved` y el vendedor lo edita, el comprador interesado debe ver una **alerta/banner** en su pantalla de detalle de orden indicando que hubo cambios.

## 4. Validaciones de Usuario

- **Teléfono:**
  - Validación únicamente por **Formato (Regex)** al registrarse o editar perfil.
  - No se requiere verificación SMS (Firebase Phone Auth) para el MVP.
  - Formato esperado: 9 dígitos (Perú).

## 5. Gestión del Vendedor

- **Dashboard:** Debe tener una sección explícita de "Solicitudes Pendientes" para confirmar o rechazar reservas.
