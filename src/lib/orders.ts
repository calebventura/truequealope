import { auth } from '@/lib/firebaseClient';

export async function createOrder(productId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  // Obtener el ID token del usuario actual
  const idToken = await user.getIdToken();

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      productId,
    })
  });

  // Parse response safely (JSON first, fallback to text)
  const rawText = await response.text();
  let payload: unknown = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    // keep payload as null and use rawText
  }

  if (!response.ok) {
    const message =
      (payload as { error?: string })?.error ||
      rawText ||
      `Error creating order (status ${response.status})`;
    throw new Error(message);
  }

  return (payload ?? rawText) as unknown;
}
