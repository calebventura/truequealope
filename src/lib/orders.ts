import { auth } from '@/lib/firebaseClient';

export async function createOrder(sellerId: string, productId: string, price: number) {
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
      sellerId,
      productId,
      price
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Error creating order');
  }

  return await response.json();
}
