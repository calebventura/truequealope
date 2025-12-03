# Modelo de Datos Firestore - Reutilizalope

Este documento define el esquema de datos NoSQL para Cloud Firestore.

## 1. Colección: `users`
Almacena la información de perfil de los usuarios (compradores y vendedores).

| Campo | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `uid` | String | `"7Fz...9a"` | ID único (mismo que Auth). Document ID. |
| `displayName` | String | `"Juan Pérez"` | Nombre público. |
| `email` | String | `"juan@email.com"` | Correo electrónico. |
| `photoURL` | String | `"https://..."` | URL de foto de perfil. |
| `phoneNumber` | String | `"+54911..."` | Contacto para WhatsApp. |
| `createdAt` | Timestamp | `2023-10-25...` | Fecha de registro. |
| `rating` | Number | `4.8` | Promedio de calificaciones (opcional). |

*   **Índices Recomendados:** Ninguno crítico para MVP (búsquedas por ID).
*   **Reglas de Seguridad:**
    *   `read`: Público (o solo autenticados).
    *   `write`: Solo el propio usuario (`request.auth.uid == resource.id`).

---

## 2. Colección: `products`
Catálogo de artículos a la venta.

| Campo | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `id` | String | `"prod_123"` | Auto-ID. |
| `sellerId` | String | `"7Fz...9a"` | ID del usuario vendedor. |
| `title` | String | `"Bicicleta MTB"` | Título del anuncio. |
| `description` | String | `"Usada, buen estado..."` | Descripción detallada. |
| `price` | Number | `15000` | Precio en moneda local. |
| `categoryId` | String | `"deportes"` | Slug de la categoría. |
| `images` | Array<String> | `["url1", "url2"]` | URLs de imágenes. |
| `status` | String | `"active"` | `active`, `sold`, `paused`. |
| `createdAt` | Timestamp | `2023-10-26...` | Fecha de publicación. |
| `searchKeywords`| Array<String> | `["bici", "mtb"]` | Para búsqueda simple ("array-contains"). |

*   **Índices Recomendados:**
    *   `categoryId` + `createdAt` (DESC) -> Para filtrar por categoría y ver recientes.
    *   `sellerId` + `createdAt` (DESC) -> Para perfil del vendedor.
    *   `price` (ASC/DESC) -> Para ordenar por precio.
*   **Reglas de Seguridad:**
    *   `read`: Público (solo si `status == 'active'`).
    *   `create`: Solo autenticados.
    *   `update/delete`: Solo el dueño (`resource.data.sellerId == request.auth.uid`).

---

## 3. Colección: `categories`
Categorías estáticas del sistema.

| Campo | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `id` | String | `"deportes"` | Slug como ID. |
| `name` | String | `"Deportes y Aire Libre"` | Nombre visible. |
| `icon` | String | `"bicycle"` | Nombre de icono o URL. |
| `order` | Number | `1` | Para ordenar en el menú. |

*   **Índices Recomendados:** `order` (ASC).
*   **Reglas de Seguridad:**
    *   `read`: Público.
    *   `write`: Solo administradores (o deshabilitado desde cliente).

---

## 4. Colección: `chats`
Conversaciones privadas entre usuarios.

| Campo | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `id` | String | `"chat_abc"` | Auto-ID. |
| `participants` | Array<String> | `["uid_buyer", "uid_seller"]` | IDs de los usuarios en el chat. |
| `productId` | String | `"prod_123"` | Producto sobre el que hablan. |
| `lastMessage` | String | `"Hola, sigue disponible?"` | Vista previa en lista de chats. |
| `lastMessageAt` | Timestamp | `2023-10-27...` | Para ordenar lista de chats. |
| `unreadCount` | Map | `{"uid_buyer": 1}` | Contadores de no leídos. |

*   **Índices Recomendados:**
    *   `participants` (array-contains) + `lastMessageAt` (DESC).
*   **Reglas de Seguridad:**
    *   `read/write`: Solo si `request.auth.uid` está en `participants`.

---

## 5. Subcolección: `chats/{chatId}/messages`
Mensajes individuales dentro de un chat.

| Campo | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `id` | String | `"msg_xyz"` | Auto-ID. |
| `senderId` | String | `"uid_buyer"` | Quién envió el mensaje. |
| `content` | String | `"¿Aceptas 14000?"` | Texto del mensaje. |
| `createdAt` | Timestamp | `2023-10-27...` | Hora del mensaje. |
| `read` | Boolean | `false` | Estado de lectura. |

*   **Índices Recomendados:** `createdAt` (ASC).
*   **Reglas de Seguridad:**
    *   Heredan acceso del documento padre `chat`.

---

## 6. Colección: `orders`
Registro de transacciones (Post-MVP si hay pago en línea).

| Campo | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `id` | String | `"ord_999"` | Auto-ID. |
| `buyerId` | String | `"uid_buyer"` | Comprador. |
| `sellerId` | String | `"uid_seller"` | Vendedor. |
| `productId` | String | `"prod_123"` | Producto comprado. |
| `amount` | Number | `15000` | Monto final. |
| `status` | String | `"paid"` | `pending`, `paid`, `shipped`, `completed`. |
| `createdAt` | Timestamp | `2023-10-28...` | Fecha de orden. |

*   **Índices Recomendados:**
    *   `buyerId` + `createdAt` (DESC).
    *   `sellerId` + `createdAt` (DESC).
*   **Reglas de Seguridad:**
    *   `read`: Solo `buyerId` o `sellerId`.
    *   `write`: Generalmente solo backend (Cloud Functions) o flujos muy controlados.

---

## 7. Colección: `reviews`
Calificaciones de usuarios tras una compra.

| Campo | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `id` | String | `"rev_555"` | Auto-ID. |
| `orderId` | String | `"ord_999"` | Orden asociada (para verificar compra). |
| `reviewerId` | String | `"uid_buyer"` | Quién deja la review. |
| `targetUserId` | String | `"uid_seller"` | A quién califican. |
| `rating` | Number | `5` | 1 a 5 estrellas. |
| `comment` | String | `"Excelente vendedor"` | Texto. |
| `createdAt` | Timestamp | `2023-10-29...` | Fecha. |

*   **Índices Recomendados:**
    *   `targetUserId` + `createdAt` (DESC) -> Para mostrar reviews en perfil.
*   **Reglas de Seguridad:**
    *   `read`: Público.
    *   `create`: Solo si `reviewerId` es el usuario actual y existe una `order` completada (validar en reglas o Cloud Function).
