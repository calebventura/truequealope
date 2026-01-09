import { CATEGORIES } from '@/lib/constants';
import { Product } from '@/types/product';

describe('Release 1.0 - Business Model Changes', () => {
  test('Category "Regalo de mi ex" should NOT exist anymore', () => {
    const exGiftCategory = CATEGORIES.find(c => c.id === 'ex-gift');
    expect(exGiftCategory).toBeUndefined();
  });

  test('Product interface should support new fields', () => {
    const newProduct: Product = {
      sellerId: 'user123',
      title: 'Peluche de mi ex',
      description: 'Recuerdo doloroso',
      categoryId: 'ex-gift',
      images: [],
      status: 'active',
      condition: 'used',
      location: 'Lima',
      createdAt: new Date(),
      listingType: 'product',
      acceptedExchangeTypes: ['giveaway', 'exchange_plus_cash'],
      exchangeCashDelta: 50
    };

    expect(newProduct.listingType).toBe('product');
    expect(newProduct.acceptedExchangeTypes).toContain('giveaway');
    expect(newProduct.acceptedExchangeTypes).toContain('exchange_plus_cash');
    expect(newProduct.exchangeCashDelta).toBe(50);
  });

  test('Product interface should support Service listing', () => {
    const serviceListing: Product = {
      sellerId: 'user123',
      title: 'Clases de Guitarra',
      description: 'Enseño canciones tristes',
      categoryId: 'other',
      images: [],
      status: 'active',
      condition: 'new', // Condition might be irrelevant for services, but required by type for now
      location: 'Arequipa',
      createdAt: new Date(),
      listingType: 'service',
      acceptedExchangeTypes: ['money', 'service'],
      price: 50
    };

    expect(serviceListing.listingType).toBe('service');
    expect(serviceListing.acceptedExchangeTypes).toContain('service');
  });
});
