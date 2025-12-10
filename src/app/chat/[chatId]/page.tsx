'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import { useAuth } from '@/hooks/useAuth';
import { Message } from '@/lib/chat';

export default function ChatPage() {
  const { chatId } = useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [productTitle, setProductTitle] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll al fondo cuando llegan mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cargar info del chat (para obtener productId y luego título)
  useEffect(() => {
    if (!chatId) return;
    
    const fetchChatInfo = async () => {
      const chatDoc = await getDoc(doc(db, 'chats', chatId as string));
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        // Obtener info del producto
        if (chatData.productId) {
          const productDoc = await getDoc(doc(db, 'products', chatData.productId));
          if (productDoc.exists()) {
            setProductTitle(productDoc.data().title);
          }
        }
      }
    };
    fetchChatInfo();
  }, [chatId]);

  // Suscripción a mensajes
  useEffect(() => {
    if (!chatId) return;

    const messagesRef = collection(db, 'chats', chatId as string, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [chatId]);

  // Redirigir si no está logueado
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !chatId) return;

    setSending(true);
    try {
      // 1. Agregar mensaje a subcolección
      await addDoc(collection(db, 'chats', chatId as string, 'messages'), {
        text: newMessage,
        from: user.uid,
        createdAt: serverTimestamp()
      });

      // 2. Actualizar último mensaje en el documento del chat
      await updateDoc(doc(db, 'chats', chatId as string), {
        lastMessage: newMessage,
        updatedAt: serverTimestamp()
      });

      setNewMessage('');
    } catch (error) {
      console.error("Error enviando mensaje:", error);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando chat...</div>;

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] md:h-[calc(100vh-64px)] bg-gray-100">
      {/* Header del Chat */}
      <div className="bg-white border-b px-4 py-3 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            {productTitle ? `Chat sobre: ${productTitle}` : 'Chat'}
          </h2>
        </div>
        <button 
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Volver
        </button>
      </div>

      {/* Lista de Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMyMessage = msg.from === user?.uid;
          return (
            <div 
              key={msg.id} 
              className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[70%] rounded-lg px-4 py-2 shadow-sm ${
                  isMyMessage 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white text-gray-800 rounded-bl-none'
                }`}
              >
                <p>{msg.text}</p>
                <span className={`text-[10px] block text-right mt-1 ${
                  isMyMessage ? 'text-blue-100' : 'text-gray-400'
                }`}>
                  {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de Mensaje */}
      <div className="bg-white p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-blue-600 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
