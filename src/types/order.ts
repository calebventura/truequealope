import { Timestamp } from 'firebase/firestore';

export interface Order {
  id: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  price: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date | Timestamp;
  productTitle: string;
  productImage?: string;
}
