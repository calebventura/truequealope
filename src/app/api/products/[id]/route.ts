import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ProductService } from "@/lib/services/productService";
import { Product } from "@/types/product";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const sellerId = decodedToken.uid;

    const body = await request.json();
    
    // Construct product object for service (partial)
    // We assume the service handles fetching the current product to check status
    // But ProductService.updateProduct expects the *current* product object to check status.
    // We should fetch it here or let service fetch it.
    // Looking at ProductService.ts I wrote: `updateProduct(sellerId, product, updates)`
    // It takes the *product object*. So I need to fetch it here.
    
    // Actually, I'll update ProductService to fetch it if needed, or fetch here.
    // I'll fetch here using Admin SDK.
    const productSnap = await adminDb.collection("products").doc(id).get();
    
    if (!productSnap.exists) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    
    const productData = { id: productSnap.id, ...productSnap.data() } as Product;
    
    if (productData.sellerId !== sellerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await ProductService.updateProduct(sellerId, productData, body);

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
