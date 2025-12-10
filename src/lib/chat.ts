import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';

export interface Chat {
  id: string;
  participants: string[];
  productId: string;
  updatedAt: Timestamp;
  lastMessage?: string;
}

export interface Message {
  id: string;
  from: string;
  text: string;
  createdAt: Timestamp;
}

/**
 * Busca un chat existente entre comprador y vendedor para un producto específico,
 * o crea uno nuevo si no existe.
 */
export async function createOrGetChat(buyerId: string, sellerId: string, productId: string): Promise<string> {
  try {
    // 1. Buscar si ya existe el chat
    // Nota: Firestore requiere un índice compuesto para consultas con múltiples campos.
    // Para evitar errores de índice en este MVP, consultamos por productId y filtramos en cliente.
    // En producción, idealmente usarías: 
    // .where('participants', 'array-contains', buyerId) y un índice compuesto.
    
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('productId', '==', productId));
    const querySnapshot = await getDocs(q);

    let existingChatId = null;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (
        data.participants.includes(buyerId) && 
        data.participants.includes(sellerId)
      ) {
        existingChatId = doc.id;
      }
    });

    if (existingChatId) {
      return existingChatId;
    }

    // 2. Si no existe, crear uno nuevo
    const newChatRef = await addDoc(chatsRef, {
      participants: [buyerId, sellerId],
      productId: productId,
      updatedAt: serverTimestamp(),
      lastMessage: ''
    });

    return newChatRef.id;

  } catch (error) {
    console.error("Error en createOrGetChat:", error);
    throw error;
  }
}
