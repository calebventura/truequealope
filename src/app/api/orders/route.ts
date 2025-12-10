import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';

export async function POST(request: Request) {
  try {
    // 1. Validar autenticación (Bearer Token)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const buyerId = decodedToken.uid;

    // 2. Obtener datos del body
    const { sellerId, productId, price } = await request.json();

    if (!sellerId || !productId || !price) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // 3. Validar estado del producto
    const productRef = adminDb.collection('products').doc(productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const productData = productSnap.data();
    if (productData?.status !== 'active') {
      return NextResponse.json({ error: 'Product is not active' }, { status: 400 });
    }

    // 4. Crear la orden
    const orderData = {
      buyerId,
      sellerId,
      productId,
      price,
      status: 'completed', // En este MVP sin pasarela de pago, la orden nace completada
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      productTitle: productData.title,
      productImage: productData.images?.[0] || null,
    };

    const orderRef = await adminDb.collection('orders').add(orderData);

    // 5. Marcar producto como VENDIDO
    await productRef.update({ status: 'sold' });

    return NextResponse.json({ orderId: orderRef.id, status: 'success' });

  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
