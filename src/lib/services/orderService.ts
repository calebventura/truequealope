import { adminDb } from '@/lib/firebaseAdmin';
import { Product, TimestampLike } from '@/types/product';
import * as admin from 'firebase-admin';

class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const resolveTimestamp = (value: TimestampLike | null | undefined) => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  if (typeof value === "object" && "toDate" in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate();
    }
  }
  return undefined;
};

export class OrderService {
  static async createOrder(buyerId: string, productId: string) {
    if (!productId) {
      throw new HttpError("Missing productId", 400);
    }

    const productRef = adminDb.collection('products').doc(productId);
    const ordersRef = adminDb.collection('orders');

    return await adminDb.runTransaction(async (tx) => {
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists) throw new HttpError("Product not found", 404);

      const productData = productSnap.data() as Product;
      if (productData.sellerId === buyerId) {
        throw new HttpError("No puedes comprar tu propio producto", 400);
      }
      
      const RESERVATION_TIME_MINUTES = parseInt(process.env.NEXT_PUBLIC_RESERVATION_TIME_MINUTES || '120');
      
      if (productData.status === 'sold') {
        throw new HttpError("Product is already sold", 400);
      }

      if (productData.status === 'reserved') {
          // Lazy Validation: Check expiration
          const reservedAt = resolveTimestamp(productData.reservedAt);

          if (reservedAt && !isNaN(reservedAt.getTime())) {
              const now = new Date();
              const expirationTime = new Date(reservedAt.getTime() + RESERVATION_TIME_MINUTES * 60000);
              
              if (now <= expirationTime) {
                  throw new HttpError("Product is currently reserved", 400);
              }
              // If expired, allow overwriting (proceeds to logic below)
          }
      } else if (productData.status !== 'active') {
        throw new HttpError("Product is not active", 400);
      }

      // ... (rest of validation logic like seller != buyer, etc.)

      const orderRef = ordersRef.doc();
      const orderData = {
        buyerId,
        sellerId: productData.sellerId,
        productId,
        price: productData.price,
        status: 'pending', // Rule 1: Starts as pending (Reserved)
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        productTitle: productData.title,
        productImage: productData.images?.[0] || null,
      };

      tx.set(orderRef, orderData);
      tx.update(productRef, { 
          status: 'reserved',
          reservedAt: admin.firestore.FieldValue.serverTimestamp() // Rule 3 support
      });

      return { orderId: orderRef.id, status: 'pending' };
    });
  }

  static async confirmOrder(sellerId: string, orderId: string) {
    if (!orderId) {
      throw new HttpError("Missing orderId", 400);
    }
    // Implement Rule 1 part 2
    const orderRef = adminDb.collection('orders').doc(orderId);

    return await adminDb.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw new HttpError("Order not found", 404);

      const orderData = orderSnap.data();
      if (orderData?.sellerId !== sellerId) throw new HttpError("Unauthorized", 403);

      const status = orderData?.status;
      if (status === 'completed') {
        return; // idempotent success
      }
      if (status !== 'pending') {
        throw new HttpError("Order is not pending", 400);
      }

      const productId = orderData?.productId as string | undefined;
      if (!productId) throw new HttpError("Order has no productId", 400);
      const productRef = adminDb.collection('products').doc(productId);
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists) throw new HttpError("Product not found", 404);

      // Rule 1: Confirm -> SOLD
      tx.update(orderRef, { status: 'completed' });
      tx.update(productRef, {
        status: 'sold',
        soldAt: admin.firestore.FieldValue.serverTimestamp() // Rule 2 support
      });
    });
  }

  static async rejectOrder(sellerId: string, orderId: string) {
    if (!orderId) {
      throw new HttpError("Missing orderId", 400);
    }
    // Implement Rule 7
    const orderRef = adminDb.collection('orders').doc(orderId);

    return await adminDb.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw new HttpError("Order not found", 404);

      const orderData = orderSnap.data();
      if (orderData?.sellerId !== sellerId) throw new HttpError("Unauthorized", 403);

      const status = orderData?.status;
      if (status === 'cancelled') {
        return; // idempotent
      }
      if (status !== 'pending') throw new HttpError("Order is not pending", 400);

      const productId = orderData?.productId as string | undefined;
      if (!productId) throw new HttpError("Order has no productId", 400);
      const productRef = adminDb.collection('products').doc(productId);

      // Rule 7: Reject -> CANCELLED, Product -> ACTIVE
      tx.update(orderRef, { status: 'cancelled' });
      tx.update(productRef, { status: 'active' }); // Remove reservedAt if needed
    });
  }
}
