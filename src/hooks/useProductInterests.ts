import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import { InterestedUser } from '@/components/ui/AvatarStack';
import { useAuth } from '@/hooks/useAuth';

export function useProductInterests(productId: string, sellerId: string) {
  const { user } = useAuth();
  const [interestedUsers, setInterestedUsers] = useState<InterestedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInterests = async () => {
      // Solo ejecutamos si tenemos producto, sellerId y usuario autenticado
      if (!productId || !sellerId || !user) {
        setLoading(false);
        return;
      }

      // Si el usuario actual NO es el vendedor, no debería ver la lista de interesados de otros.
      // (Aunque la UI lo oculte, es mejor no hacer la query).
      if (user.uid !== sellerId) {
        setInterestedUsers([]);
        setLoading(false);
        return;
      }

      try {
        // 1. Buscar TODOS los chats donde soy participante.
        // Simplificamos la query para evitar problemas de índices compuestos y permisos complejos.
        // Filtraremos por productId en memoria (cliente).
        const q = query(
          collection(db, 'chats'),
          where('participants', 'array-contains', user.uid)
        );
        
        const snapshot = await getDocs(q);
        const users: InterestedUser[] = [];

        // 2. Filtrar por producto y procesar
        for (const chatDoc of snapshot.docs) {
          const chatData = chatDoc.data();
          
          // Filtro en cliente: Solo chats de ESTE producto
          if (chatData.productId !== productId) continue;

          const participants = chatData.participants as string[];
          
          // El interesado es el participante que NO es el vendedor (o sea, no soy yo)
          const interestedId = participants.find(id => id !== user.uid);

          if (interestedId) {
            // 3. Obtener datos del usuario
            const userDocRef = doc(db, 'users', interestedId);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              users.push({
                id: interestedId,
                name: userData.displayName || userData.email || 'Usuario',
                photoURL: userData.photoURL,
                chatId: chatDoc.id
              });
            } else {
                users.push({
                    id: interestedId,
                    name: 'Usuario',
                    chatId: chatDoc.id
                });
            }
          }
        }

        setInterestedUsers(users);
      } catch (error) {
        console.error("Error fetching interests:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInterests();
  }, [productId, sellerId, user]);

  return { interestedUsers, loading };
}
