# Especificaciones: Release 1.2 - Flujo de Publicación sin Fricción

## 1. Persistencia de "Borrador" (Draft)

**Requerimiento:** Si un usuario no logueado intenta publicar, pedir login pero no perder lo que escribió.

- **Flujo Propuesto:**
  1.  Usuario entra a `/products/new`.
  2.  Formulario visible (actualmente redirige o bloquea).
      - _Cambio:_ Permitir ver el formulario.
  3.  Usuario llena datos.
  4.  Usuario da click en "Publicar".
  5.  Sistema detecta `!user`.
  6.  Sistema guarda datos del form en `localStorage.setItem('product_draft', JSON.stringify(formData))`.
  7.  Sistema redirige a `/auth/login?returnUrl=/products/new`.

## 2. Restauración de Borrador

**Requerimiento:** Al volver logueado, recuperar los datos.

- **Flujo Propuesto:**
  1.  Usuario se loguea exitosamente.
  2.  `LoginPage` redirige a `returnUrl` (`/products/new`).
  3.  `products/new` monta el componente.
  4.  `useEffect` verifica existencia de `product_draft` en localStorage.
  5.  Si existe, hace `reset(JSON.parse(draft))` para llenar el formulario react-hook-form.
  6.  Mostrar mensaje toast/alert: "Hemos recuperado tu publicación pendiente".
  7.  Al publicar exitosamente, hacer `localStorage.removeItem('product_draft')`.

## Plan de Ejecución

1.  Modificar `src/app/products/new/page.tsx` para permitir acceso (o manejo parcial) sin auth, o manejar el guardado antes del redirect si el middleware lo permite.
    - _Nota:_ Si hay protección de ruta a nivel de layout/middleware, habrá que ajustarla para permitir cargar la página y solo exigir auth al enviar, O guardar estado antes de que el guard de auth patee al usuario (más complejo).
    - _Estrategia recomendada:_ Permitir acceso a la ruta, pero el botón "Publicar" dispara el flujo de Auth si no hay usuario.
2.  Implementar lógica de `localStorage` en `onSubmit` (si no auth) y en `useEffect` (al cargar).
