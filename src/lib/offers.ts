import { addDoc, collection, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

type PermutaOfferInput = {
  productId: string;
  sellerId: string;
  userId: string;
  itemOffer: string;
  cashOffer: number;
};

/**
 * Registra una oferta de permuta (producto/servicio + monto).
 */
export async function createPermutaOffer({
  productId,
  sellerId,
  userId,
  itemOffer,
  cashOffer,
}: PermutaOfferInput) {
  const productRef = doc(db, "products", productId);
  await addDoc(collection(productRef, "offers"), {
    productId,
    sellerId,
    userId,
    itemOffer,
    cashOffer,
    type: "permuta",
    createdAt: serverTimestamp(),
  });
}
