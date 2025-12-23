
import { adminDb } from '@/lib/firebaseAdmin';
import { Product } from '@/types/product';
import * as admin from 'firebase-admin';

export class OrderService {
  static async createOrder(buyerId: string, productId: string) {
    const productRef = adminDb.collection('products').doc(productId);
    const ordersRef = adminDb.collection('orders');

    return await adminDb.runTransaction(async (tx) => {
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists) throw new Error("Product not found");

      const productData = productSnap.data() as Product;
      
      const RESERVATION_TIME_MINUTES = parseInt(process.env.NEXT_PUBLIC_RESERVATION_TIME_MINUTES || '120');
      
      if (productData.status === 'reserved') {
          // Lazy Validation: Check expiration
          let reservedAt: Date | undefined;
          
          if (productData.reservedAt && typeof (productData.reservedAt as any).toDate === 'function') {
              reservedAt = (productData.reservedAt as any).toDate();
          } else if (productData.reservedAt instanceof Date) {
              reservedAt = productData.reservedAt;
          } else if (productData.reservedAt) {
              reservedAt = new Date(productData.reservedAt as any);
          }

          if (reservedAt && !isNaN(reservedAt.getTime())) {
              const now = new Date();
              const expirationTime = new Date(reservedAt.getTime() + RESERVATION_TIME_MINUTES * 60000);
              
              if (now <= expirationTime) {
                  throw new Error("Product is currently reserved");
              }
              // If expired, allow overwriting (proceeds to logic below)
          }
      } else if (productData.status !== 'active') {
        throw new Error("Product is not active");
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
      // Implement Rule 1 part 2
      const orderRef = adminDb.collection('orders').doc(orderId);
      
      return await adminDb.runTransaction(async (tx) => {
          const orderSnap = await tx.get(orderRef);
          if (!orderSnap.exists) throw new Error("Order not found");
          
          const orderData = orderSnap.data();
          if (orderData?.sellerId !== sellerId) throw new Error("Unauthorized");
          if (orderData?.status !== 'pending') throw new Error("Order not pending");

          const productRef = adminDb.collection('products').doc(orderData.productId);
          const productSnap = await tx.get(productRef);
          
          // Rule 1: Confirm -> SOLD
          tx.update(orderRef, { status: 'completed' });
          tx.update(productRef, { 
              status: 'sold',
              soldAt: admin.firestore.FieldValue.serverTimestamp() // Rule 2 support
           });
      });
  }

  static async rejectOrder(sellerId: string, orderId: string) {
      // Implement Rule 7
      const orderRef = adminDb.collection('orders').doc(orderId);
      
      return await adminDb.runTransaction(async (tx) => {
          const orderSnap = await tx.get(orderRef);
          if (!orderSnap.exists) throw new Error("Order not found");
          
          const orderData = orderSnap.data();
          if (orderData?.sellerId !== sellerId) throw new Error("Unauthorized");
          if (orderData?.status !== 'pending') throw new Error("Order not pending");

          const productRef = adminDb.collection('products').doc(orderData.productId);
          
          // Rule 7: Reject -> CANCELLED, Product -> ACTIVE
          tx.update(orderRef, { status: 'cancelled' });
          tx.update(productRef, { status: 'active' }); // Remove reservedAt if needed
      });
  }
}
