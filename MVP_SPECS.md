# Reutilizalope - Especificaciones del MVP

## 1. Historias de Usuario Principales

### Vendedor
1. **Registro:** Como vendedor, quiero registrarme con mi correo o Google para poder publicar anuncios.
2. **Publicación:** Como vendedor, quiero subir un producto con foto, título, precio y descripción.
3. **Gestión:** Como vendedor, quiero ver mis productos y marcarlos como "Vendidos" o borrarlos.

### Comprador
1. **Exploración:** Como comprador, quiero ver un listado de productos recientes.
2. **Búsqueda:** Como comprador, quiero buscar productos por nombre o categoría.
3. **Contacto:** Como comprador, quiero contactar al vendedor vía WhatsApp para coordinar la compra.

## 2. Lista de Features Mínimas (Priorizadas)

### Fase 1: MVP (Semanas 1-4)
- **Autenticación:** Firebase Auth (Email/Password + Google).
- **Gestión de Productos:** Crear, Leer, Actualizar (Estado), Borrar.
- **Imágenes:** Subida de 1 imagen por producto a Firebase Storage.
- **Búsqueda:** Barra de búsqueda simple y filtro por categoría.
- **Contacto:** Enlace directo a API de WhatsApp (`https://wa.me/...`).
- **Perfil:** Edición básica de datos de contacto.

### Fase 2: Post-MVP
- Chat interno en tiempo real.
- Pasarela de pagos.
- Valoraciones y reseñas.
- Geolocalización.
- Favoritos.

## 3. Arquitectura de Pantallas (Rutas)

- **Home (`/`)**: Hero, Grid de productos, Buscador.
- **Auth (`/auth/login`, `/auth/register`)**: Formularios de acceso.
- **Publicar (`/vender`)**: Formulario de alta de producto (Protegida).
- **Detalle (`/productos/[id]`)**: Info del producto + Botón WhatsApp.
- **Perfil (`/perfil`)**: Mis datos y Mis publicaciones (Protegida).

## 4. Modelo de Datos (Firestore)

### Colección: `users`
```typescript
interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  phoneNumber: string; // Vital para WhatsApp
  createdAt: Timestamp;
}
```

### Colección: `products`
```typescript
interface Product {
  id: string;
  sellerId: string; // Link a users
  title: string;
  description: string;
  price: number;
  category: string; // "ropa", "muebles", etc.
  imageUrl: string;
  status: 'active' | 'sold';
  createdAt: Timestamp;
  searchKeywords: string[]; // Para búsquedas simples
}
```
