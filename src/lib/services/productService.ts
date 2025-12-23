
import { adminDb } from '@/lib/firebaseAdmin';
import { Product } from '@/types/product';

export class ProductService {
    static async updateProduct(sellerId: string, product: Product, updates: Partial<Product>) {
        if (product.status === 'sold') {
            throw new Error("Cannot edit sold product"); // Rule 4
        }
        
        // Mock transaction for simplicity in this file, normally passed in or new one created
        // Here we just assume we are inside logic that uses it or direct update
        // For the test, we mock the DB call.
        
        if (product.status === 'reserved') {
            await this.notifyInterestedParties(product); // Rule 4
        }

        // DB update logic would go here
        // adminDb.collection('products').doc(product.id).update(updates);
        // We rely on the test mocking this part via the import, 
        // but since we are in a static method without DI, checking the mocks in test requires care.
        // For this prototype, I'll invoke the global adminDb which is mocked in tests.
        
        // We need to assume `product.id` exists or is passed.
        if (product.id) {
            await adminDb.collection('products').doc(product.id).update(updates);
        }
    }

    static async notifyInterestedParties(product: Product) {
        // Rule 8: Alert/Banner (Notification logic placeholder)
        console.log(`Notify buyer of reserved product ${product.id} about changes`);
    }
}
