
import { OrderService } from '@/lib/services/orderService';
import { ProductService } from '@/lib/services/productService';
import { Order } from '@/types/order';
import { Product } from '@/types/product';

// Mock DB interfaces
const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
};

const mockRunTransaction = jest.fn((callback) => callback(mockTransaction));

const createMockDoc = (collectionPath: string, id: string) => ({
  id,
  path: `${collectionPath}/${id}`,
  get: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
});

const mockDocRefs: Record<string, any> = {};

const getDocRef = (collectionPath: string, id: string) => {
  const fullPath = `${collectionPath}/${id}`;
  if (!mockDocRefs[fullPath]) {
    mockDocRefs[fullPath] = createMockDoc(collectionPath, id);
  }
  return mockDocRefs[fullPath];
};

jest.mock('@/lib/firebaseAdmin', () => ({
  adminDb: {
    runTransaction: (cb: any) => mockRunTransaction(cb),
    collection: jest.fn((col) => ({
      doc: jest.fn((id) => getDocRef(col, id || 'new-id')),
    })),
  },
  adminAuth: {
      verifyIdToken: jest.fn()
  }
}));

// Helper to reset mocks
beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockDocRefs).forEach(key => {
    mockDocRefs[key].get.mockClear();
    mockDocRefs[key].update.mockClear();
    mockDocRefs[key].set.mockClear();
  });
});

describe('Business Rules - Truequealope', () => {
  
  describe('Rule 1: Purchasing Flow', () => {
    it('should mark product as RESERVED and order as PENDING when buyer initiates purchase', async () => {
      // Setup
      const productId = 'prod-123';
      const buyerId = 'buyer-abc';
      const sellerId = 'seller-xyz';
      
      const mockProduct: Product = {
        id: productId,
        sellerId: sellerId,
        title: 'Test Product',
        description: 'Desc',
        price: 100,
        categoryId: 'cat-1',
        images: [],
        status: 'active',
        condition: 'new',
        location: 'City',
        createdAt: new Date(),
        mode: 'sale'
      };

      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => mockProduct,
        id: productId,
        ref: getDocRef('products', productId)
      });

      // Execute
      const result = await OrderService.createOrder(buyerId, productId);

      // Assert
      expect(result.status).toBe('pending');
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'products/' + productId }),
        expect.objectContaining({ status: 'reserved' })
      );
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining('orders/') }),
        expect.objectContaining({ status: 'pending', buyerId, productId })
      );
    });

    it('should mark product as SOLD and order as COMPLETED when seller confirms', async () => {
       // Setup
       const orderId = 'order-123';
       const productId = 'prod-123';
       const sellerId = 'seller-xyz';
       
       const mockOrder: Order = {
         id: orderId,
         buyerId: 'buyer-abc',
         sellerId: sellerId,
         productId: productId,
         price: 100,
         status: 'pending',
         createdAt: new Date(),
         productTitle: 'Test Product'
       };
 
       const mockProduct: Product = {
         id: productId,
         sellerId: sellerId,
         title: 'Test Product',
         description: 'Desc',
         price: 100,
         categoryId: 'cat-1',
         images: [],
         status: 'reserved',
         condition: 'new',
         location: 'City',
         createdAt: new Date(),
         mode: 'sale'
       };
 
       // Re-mocking get for this specific test case to handle multiple gets
        mockTransaction.get
        .mockResolvedValueOnce({ exists: true, data: () => mockOrder, id: orderId, ref: getDocRef('orders', orderId) }) // 1. Get Order
        .mockResolvedValueOnce({ exists: true, data: () => mockProduct, id: productId, ref: getDocRef('products', productId) }); // 2. Get Product

       // Execute
       await OrderService.confirmOrder(sellerId, orderId);
 
       // Assert
       expect(mockTransaction.update).toHaveBeenCalledWith(
         expect.objectContaining({ path: 'orders/' + orderId }),
         expect.objectContaining({ status: 'completed' })
       );
       expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'products/' + productId }),
         expect.objectContaining({ status: 'sold' })
       );
    });

    it('should allow purchasing a RESERVED product if reservation expired (Rule 1.4)', async () => {
        // Setup
        const productId = 'prod-expired';
        const buyerId = 'buyer-new';
        
        // Mock expiration time setup (2 hours default)
        const expiredDate = new Date();
        expiredDate.setMinutes(expiredDate.getMinutes() - 130); // 130 mins ago > 120 mins limit

        const mockProduct = {
            id: productId,
            status: 'reserved',
            reservedAt: { toDate: () => expiredDate }, // Mock Firestore Timestamp
            sellerId: 'seller-1',
            price: 50,
            title: 'Expired Product'
        } as unknown as Product;

        mockTransaction.get.mockResolvedValue({
            exists: true,
            data: () => mockProduct,
            id: productId,
            ref: getDocRef('products', productId)
        });

        // Execute
        const result = await OrderService.createOrder(buyerId, productId);

        // Assert
        expect(result.status).toBe('pending');
        expect(mockTransaction.update).toHaveBeenCalledWith(
            expect.objectContaining({ path: 'products/' + productId }),
            expect.objectContaining({ status: 'reserved' }) // Should be re-reserved
        );
    });

    it('should BLOCK purchasing a RESERVED product if NOT expired', async () => {
        // Setup
        const productId = 'prod-active-reserved';
        const buyerId = 'buyer-late';
        
        // Mock active reservation (just made)
        const recentDate = new Date();
        recentDate.setMinutes(recentDate.getMinutes() - 10); // 10 mins ago < 120 mins limit

        const mockProduct = {
            id: productId,
            status: 'reserved',
            reservedAt: { toDate: () => recentDate },
            sellerId: 'seller-1',
        } as unknown as Product;

        mockTransaction.get.mockResolvedValue({
            exists: true,
            data: () => mockProduct,
            id: productId,
            ref: getDocRef('products', productId)
        });

        // Execute & Assert
        await expect(OrderService.createOrder(buyerId, productId))
            .rejects.toThrow('Product is currently reserved');
    });
  });

  describe('Rule 4: Edit Restrictions', () => {
    it('should allow editing if product is ACTIVE', async () => {
        const productId = 'prod-active';
        const product = { id: productId, status: 'active' } as Product;
        const updates = { title: 'New Title' };
        
        await ProductService.updateProduct('seller-1', product, updates);
        
        const productRef = getDocRef('products', productId);
        expect(productRef.update).toHaveBeenCalledWith(updates);
    });

    it('should allow editing if RESERVED but trigger notification', async () => {
        const productId = 'prod-reserved';
        const product = { id: productId, status: 'reserved' } as Product;
        const updates = { title: 'New Title' };
        
        const notifySpy = jest.spyOn(ProductService, 'notifyInterestedParties');
        notifySpy.mockResolvedValue();

        await ProductService.updateProduct('seller-1', product, updates);
        
        const productRef = getDocRef('products', productId);
        expect(productRef.update).toHaveBeenCalled();
        expect(notifySpy).toHaveBeenCalled();
    });

    it('should DENY editing if product is SOLD', async () => {
        const product = { status: 'sold' } as Product;
        const updates = { title: 'New Title' };
        
        await expect(ProductService.updateProduct('seller-1', product, updates))
            .rejects.toThrow('Cannot edit sold product');
    });
  });

  describe('Rule 7: Reject Reservation', () => {
      it('should set order to CANCELLED and product back to ACTIVE', async () => {
        const orderId = 'order-123';
        const productId = 'prod-123';
        const sellerId = 'seller-xyz';

        const mockOrder = { id: orderId, sellerId, productId, status: 'pending' };
        const mockProduct = { id: productId, status: 'reserved' };

        mockTransaction.get
        .mockResolvedValueOnce({ exists: true, data: () => mockOrder, id: orderId, ref: getDocRef('orders', orderId) })
        .mockResolvedValueOnce({ exists: true, data: () => mockProduct, id: productId, ref: getDocRef('products', productId) });

        await OrderService.rejectOrder(sellerId, orderId);

        expect(mockTransaction.update).toHaveBeenCalledWith(
            expect.objectContaining({ path: 'orders/' + orderId }),
            expect.objectContaining({ status: 'cancelled' })
        );
        expect(mockTransaction.update).toHaveBeenCalledWith(
            expect.objectContaining({ path: 'products/' + productId }),
            expect.objectContaining({ status: 'active' })
        );
      });
  });


});
