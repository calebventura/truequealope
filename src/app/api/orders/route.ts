import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { OrderService } from "@/lib/services/orderService";

type HttpError = Error & { status?: number };

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
      | { productId?: unknown }
      | null;

    const productId = body?.productId;
    if (typeof productId !== "string" || !productId) {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }

    const result = await OrderService.createOrder(buyerId, productId);

    return NextResponse.json(result);
  } catch (error) {
    const status = (error as HttpError).status || 500;
    const message = (error as Error).message || "Internal Server Error";

    console.error("Error creating order:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
