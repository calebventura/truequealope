import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { OrderService } from "@/lib/services/orderService";

export async function POST(
  request: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams =
      "params" in ctx && typeof (ctx.params as any)?.then === "function"
        ? await (ctx.params as Promise<{ id: string }>)
        : (ctx as { params: { id: string } }).params;

    const { id: orderId } = resolvedParams || {};
    if (!orderId) {
      console.error("Missing orderId in reject handler", { params: resolvedParams });
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const sellerId = decodedToken.uid;

    await OrderService.rejectOrder(sellerId, orderId);

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Error rejecting order:", error);
    const status = (error as { status?: number }).status ?? 500;
    const message = (error as Error).message || "Internal Server Error";
    return NextResponse.json({ error: message }, { status });
  }
}
