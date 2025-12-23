import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { OrderService } from "@/lib/services/orderService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const sellerId = decodedToken.uid;

    await OrderService.confirmOrder(sellerId, orderId);

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Error confirming order:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
