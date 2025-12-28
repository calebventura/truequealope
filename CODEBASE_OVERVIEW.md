# Documentación y Guía del Código de Truequealo.pe

Este documento proporciona una descripción general completa del proyecto Truequealo.pe, su arquitectura, componentes clave y guías para nuevos desarrolladores.

## 1. Resumen del Proyecto

Truequealo.pe es una aplicación web construida con Next.js y Firebase, diseñada como una plataforma de marketplace para el trueque o intercambio de productos. Los usuarios pueden registrarse, publicar productos que ofrecen, buscar productos de otros y ponerse en contacto para realizar intercambios.

## 2. Stack Tecnológico

- **Framework principal:** [Next.js](https://nextjs.org/) (v16+)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **UI:** [React](https://react.dev/) (v19+)
- **Estilos:** [Tailwind CSS](https://tailwindcss.com/) (v4+)
- **Backend y Base de Datos:**
  - **Autenticación:** [Firebase Authentication](https://firebase.google.com/docs/auth)
  - **Base de Datos:** [Cloud Firestore](https://firebase.google.com/docs/firestore)
  - **Almacenamiento:** [Firebase Storage](https://firebase.google.com/docs/storage)
- **Validación de Formularios:** [React Hook Form](https://react-hook-form.com/) con [Zod](https://zod.dev/)
- **Linting:** [ESLint](https://eslint.org/)

## 3. Estructura de Archivos Principal

La estructura del código fuente (`src`) está organizada de la siguiente manera:

```
src/
├── app/          # Rutas, páginas y layouts (App Router de Next.js)
│   ├── (private)/  # Rutas protegidas que requieren autenticación
│   ├── api/        # Rutas de API del backend
│   ├── auth/       # Páginas de autenticación (login, register)
│   └── ...
├── components/   # Componentes React reutilizables
│   ├── ui/         # Componentes de UI básicos (ej. Button)
│   └── ...
├── hooks/        # Hooks de React personalizados (ej. useAuth)
├── lib/          # Lógica de negocio y clientes de servicios (Firebase)
└── types/        # Definiciones de tipos de TypeScript
```

## 4. Rutas y Páginas (App Router)

El enrutamiento se gestiona mediante el App Router de Next.js en la carpeta `src/app`.

- **/ (page.tsx):** Página de inicio principal.
- **/search (search/page.tsx):** Página para buscar productos.
- **/products/new (products/new/page.tsx):** Formulario para crear una nueva publicación de producto.
- **/products/[id] (products/[id]/page.tsx):** Página de detalles de un producto específico.
- **/profile (profile/page.tsx):** Página del perfil del usuario.
- **/auth/login (auth/login/page.tsx):** Página de inicio de sesión.
- **/auth/register (auth/register/page.tsx):** Página de registro de nuevos usuarios.
- **/auth/forgot-password (auth/forgot-password/page.tsx):** Página para restablecer la contraseña.

### Rutas Privadas (`(private)`)

Estas rutas requieren que el usuario esté autenticado.

- **/dashboard (private/dashboard/page.tsx):** Panel de control del usuario.
- **/activity (private/activity/page.tsx):** Actividad reciente del usuario.
- **/mis-compras (private/mis-compras/page.tsx):** Historial de compras/intercambios del usuario.

### Rutas de API

- **/api/orders (api/orders/route.ts):** Endpoint para gestionar órdenes o intercambios.

## 5. Componentes Principales

Ubicados en `src/components`, estos son algunos de los componentes más importantes:

- **`AppShell.tsx`:** Componente principal que envuelve el contenido de la aplicación, probablemente incluyendo la `Navbar` y `BottomNav`.
- **`Navbar.tsx`:** Barra de navegación superior.
- **`BottomNav.tsx`:** Barra de navegación inferior, común en interfaces móviles.
- **`TestFirestoreClient.tsx`:** Un componente de prueba para verificar la conexión con Firestore.
- **`ui/Button.tsx`:** Componente de botón reutilizable y estilizado.

## 6. Integración con Firebase

La lógica de Firebase está centralizada en `src/lib`.

- **`firebaseClient.ts`:** Configuración del cliente de Firebase para el lado del navegador. Utiliza las variables `NEXT_PUBLIC_*`.
- **`firebaseAdmin.ts`:** Configuración del SDK de Admin de Firebase para el lado del servidor. Utiliza las variables `FIREBASE_*` privadas.
- **`auth.ts` (`src/hooks/useAuth.tsx`):** Lógica relacionada con la autenticación, como el hook `useAuth` que proporciona el estado de autenticación del usuario en toda la aplicación.
- **`userProfile.ts`:** Funciones para gestionar los perfiles de usuario en Firestore.
- **`orders.ts`:** Funciones para gestionar las órdenes/intercambios en Firestore.
- **`storage.ts`:** Funciones para interactuar con Firebase Storage (subir, descargar imágenes).
- **`contact.ts`:** Funciones para la lógica de contacto entre usuarios.
- **`offers.ts`:** Registro de ofertas de permuta (producto/servicio + monto propuesto) antes de abrir WhatsApp.
- **`(private)/activity/page.tsx`:** Dashboard de vendedor con asignación por correo, reservas y cierre de operaciones; usa modales para capturar datos finales según tipo (venta/donación: correo; trueque: correo + ítems; permuta: correo + ítems + monto).
- **`products/[id]/page.tsx`:** Detalle del producto; muestra datos del vendedor, resumen de operación final cuando está vendido y refuerza tooltips de precio referencial para permutas.
- **`firestore.rules` y `storage.rules`:** Definen las reglas de seguridad para la base de datos y el almacenamiento de archivos, respectivamente.

## 7. Variables de Entorno

Para ejecutar el proyecto, es necesario crear un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```bash
# Variables públicas de Firebase (obtenidas de la consola de Firebase)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# URL del sitio (para producción)
# NEXT_PUBLIC_SITE_URL=https://www.truequealope.pe

# Credenciales de Firebase Admin (para el backend y scripts)
# Generadas desde la consola de Firebase > Service Accounts
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Variables para los scripts de seeding (opcional)
# SEED_SELLER_UID=
# SEED_SELLER_EMAIL=
```

**Nota:** La variable `FIREBASE_PRIVATE_KEY` a menudo contiene saltos de línea. Debe ser envuelta en comillas en el archivo `.env.local`.

## 8. Cómo Empezar

### Instalación

```bash
npm install
```

### Ejecutar en Desarrollo

1.  Crea y configura tu archivo `.env.local` como se describe arriba.
2.  Ejecuta el servidor de desarrollo:

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

### Scripts Útiles

- **`npm run lint`:** Ejecuta el linter para revisar la calidad del código.
- **`npm run build`:** Compila la aplicación para producción.
- **`npm run seed:products`:** (¡CUIDADO!) Inserta datos de prueba en la base de datos de Firestore. Requiere credenciales de administrador.
- **`npm run seed:cleanup`:** (¡CUIDADO!) Limpia los datos de prueba insertados por el script anterior.

## 9. Comunidades y visibilidad

- Comunidades semilla (constantes): Comunidad Rimac, Padres/Madres, Phillips chu joy, Gamers, Estudiantes.
- Campos de producto: `communityId` opcional (categoría principal). Todas las publicaciones son públicas; `visibility` se fija en `"public"` para compatibilidad.
- No hay membresías: cualquier usuario puede ver/filtrar cualquier comunidad. La colección `userCommunities` ya no es necesaria para el acceso.
- Publicación/edición: se puede elegir comunidad (opcional) y categoría secundaria; por defecto queda "público".
- Listados (inicio y buscador): primer filtro por comunidad, luego categoría; las cards muestran un badge con la comunidad o "Público".
- Categoría “Otros”: el formulario de alta y edición obliga a ingresar `otherCategoryLabel` (texto libre). En los listados se etiqueta como “Otros” y en detalle muestra el label personalizado.

## 10. UX de contacto y permuta (resumen)
- Venta: el mensaje de WhatsApp expresa que el comprador pagará el precio completo.
- Trueque: el interesado debe escribir qué ofrece antes de contactar; se inyecta en el mensaje.
- Permuta: el interesado debe ingresar producto/servicio ofrecido y monto; ambos se guardan como oferta (`products/{productId}/offers`) y se usan en el mensaje. El precio se muestra como "Precio referencial total" con tooltip explicativo.
- Formulario de publicación: en Permuta el vendedor solo define el precio referencial total (sin monto diferencial) y los campos "qué buscas" son requeridos según el tipo de intercambio.
- Cierre de operaciones en dashboard vendedor: se exige asignar usuario por correo; al marcar vendido se capturan y guardan en el producto los datos finales (`finalBuyerContact`, `finalBuyerUserId`, `finalDealPrice`, `finalDealItems`, `finalizedAt`) y se muestran en historial y detalle.

