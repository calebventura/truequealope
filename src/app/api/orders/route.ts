import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";

type HttpError = Error & { status?: number };

function httpError(message: string, status: number): HttpError {
  const err = new Error(message) as HttpError;
  err.status = status;
  return err;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const buyerId = decodedToken.uid;

    const body = (await request.json().catch(() => null)) as
      | { productId?: unknown; sellerId?: unknown; price?: unknown }
      | null;

    const productId = body?.productId;
    if (typeof productId !== "string" || !productId) {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }

    const productRef = adminDb.collection("products").doc(productId);
    const ordersRef = adminDb.collection("orders");

    const orderId = await adminDb.runTransaction(async (tx) => {
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists) throw httpError("Product not found", 404);

      const productData = productSnap.data() as Record<string, unknown>;
      if (productData.status !== "active") {
        throw httpError("Product is not active", 400);
      }

      const sellerId = productData.sellerId;
      if (typeof sellerId !== "string" || !sellerId) {
        throw httpError("Invalid product seller", 400);
      }

      if (sellerId === buyerId) {
        throw httpError("Cannot buy your own product", 400);
      }

      const mode =
        typeof productData.mode === "string" ? productData.mode : "sale";
      if (mode === "trade") {
        throw httpError("Product is not for sale", 400);
      }

      const price = productData.price;
      if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
        throw httpError("Invalid product price", 400);
      }

      const images = Array.isArray(productData.images)
        ? (productData.images as unknown[])
        : [];

      const orderRef = ordersRef.doc();
      tx.set(orderRef, {
        buyerId,
        sellerId,
        productId,
        price,
        status: "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        productTitle:
          typeof productData.title === "string" ? productData.title : "",
        productImage: typeof images[0] === "string" ? images[0] : null,
      });

      tx.update(productRef, { status: "sold" });

      return orderRef.id;
    });

    return NextResponse.json({ orderId, status: "success" });
  } catch (error) {
    const status = (error as HttpError).status;
    if (typeof status === "number") {
      return NextResponse.json({ error: (error as Error).message }, { status });
    }

    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

