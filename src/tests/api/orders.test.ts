/**
 * @jest-environment node
 */
import { POST } from '@/app/api/orders/route';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// Mock Firebase Admin
jest.mock('@/lib/firebaseAdmin', () => ({
  adminAuth: {
    verifyIdToken: jest.fn(),
  },
  adminDb: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  },
}));

// Mock serverTimestamp
jest.mock('firebase-admin', () => ({
  firestore: {
    FieldValue: {
      serverTimestamp: () => 'MOCK_TIMESTAMP',
    },
  },
}));

describe('POST /api/orders (Order Creation Logic)', () => {
  const mockBuyerId = 'buyer-123';
  const mockSellerId = 'seller-456';
  const mockProductId = 'product-789';
  const mockPrice = 100;
  
  let mockTx: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Mock Transaction
    mockTx = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
    };

    (adminDb.runTransaction as jest.Mock).mockImplementation(async (callback) => {
      return await callback(mockTx);
    });

    // Mock Collections
    (adminDb.collection as jest.Mock).mockReturnValue({
      doc: jest.fn((id) => ({ id: id || 'generated-order-id' })),
    });
  });

  const createRequest = (body: any) => {
    return new Request('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: JSON.stringify(body),
    });
  };

  it('should create order as PENDING and mark product as RESERVED', async () => {
    // 1. Setup Auth
    (adminAuth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: mockBuyerId });

    // 2. Setup Product Data (Active)
    mockTx.get.mockResolvedValue({
      exists: true,
      data: () => ({
        sellerId: mockSellerId,
        status: 'active',
        price: mockPrice,
        title: 'Test Product',
        images: ['img1.jpg'],
      }),
    });

    // 3. Execute
    const response = await POST(createRequest({ productId: mockProductId }));
    const data = await response.json();

    // 4. Assert Success Response
    expect(response.status).toBe(200);

    // 5. Assert Business Logic (Expect failure with current code)
    // The current code writes status: 'completed' and 'sold'. We want 'pending' and 'reserved'.
    
    // Check Order Creation
    expect(mockTx.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'generated-order-id' }), // Order Ref
      expect.objectContaining({
        buyerId: mockBuyerId,
        status: 'pending', // <--- THIS SHOULD FAIL INITIALLY
      })
    );

    // Check Product Update
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: mockProductId }), // Product Ref
      expect.objectContaining({ status: 'reserved' })
    );
  });
});