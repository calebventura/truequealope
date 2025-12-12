# Deploy en Vercel (Reutilizalope)

## 1) Requisitos en Firebase

- Crear proyecto Firebase y habilitar:
  - Firestore
  - Storage
  - Authentication
- En Authentication → Sign-in method:
  - Habilitar proveedor **Google**
  - Agregar **Authorized domains**:
    - `localhost`
    - tu dominio de producción (y/o dominio `.vercel.app`)

## 2) Variables de entorno en Vercel

En Vercel → Project → Settings → Environment Variables (Production y Preview):

### Cliente (públicas)

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_SITE_URL` (recomendado: tu dominio final, ej. `https://reutilizalope.com`)

### Servidor (secretas)

- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
  - Pegar el valor con `\\n` literales (no saltos de línea reales).
  - Evitar comillas envolventes en Vercel (las toma como parte del valor).

## 3) Reglas de Firebase

Este repo incluye:
- `firestore.rules`
- `storage.rules`

Despliegue (si usas Firebase CLI):
- `firebase deploy --only firestore:rules,storage`

## 4) Notas de SEO / Compartir

- Los previews (WhatsApp/FB/X) para `/products/[id]` se generan server-side vía `generateMetadata`.
- En deploys Preview de Vercel, `robots.txt` bloquea indexación automáticamente.

