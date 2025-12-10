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
    // CORRECCIÓN: Usamos 'array-contains' para cumplir con las reglas de seguridad.
    // La regla dice: allow read: if request.auth.uid in resource.data.participants;
    // Por lo tanto, la query DEBE incluir un filtro que garantice esto.
    
    const chatsRef = collection(db, 'chats');
    // Buscamos chats donde YO (buyerId) soy participante
    const q = query(
      chatsRef, 
      where('participants', 'array-contains', buyerId)
    );
    
    const querySnapshot = await getDocs(q);

    let existingChatId = null;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Filtramos en memoria por productId y el otro participante (sellerId)
      if (
        data.productId === productId &&
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
