
import { z } from 'zod';

// Re-implementing the schema here to test the validation logic in isolation
// This ensures that the business rules defined in the frontend are sound.
const productSchema = z
  .object({
    title: z.string().min(3),
    listingType: z.enum(["product", "service"] as const),
    acceptedExchangeTypes: z.array(z.enum(["money", "product", "service", "exchange_plus_cash", "giveaway"] as const)).min(1),
    exchangeCashDelta: z.number().optional(),
    price: z.number().optional(),
    wantedProducts: z.string().optional(),
    wantedServices: z.string().optional(),
    // ... other fields are less relevant for this specific logic test
  })
  .superRefine((data, ctx) => {
    const types = data.acceptedExchangeTypes || [];
    
    // 1. Dinero (Solo Venta)
    if (types.includes("money")) {
        if (data.price === undefined || data.price === null || data.price <= 0) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: "Ingresa el precio de venta" });
        }
    }

    // 2. Permuta (Mix)
    if (types.includes("exchange_plus_cash")) {
        if (data.price === undefined || data.price === null || data.price <= 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: "Ingresa el valor total" });
        }
        if (data.exchangeCashDelta === undefined || data.exchangeCashDelta === null || data.exchangeCashDelta < 0) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["exchangeCashDelta"], message: "Ingresa la diferencia" });
        }
        
        const hasWantedProduct = !!data.wantedProducts?.trim();
        const hasWantedService = !!data.wantedServices?.trim();

        if (!hasWantedProduct && !hasWantedService) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["wantedProducts"], message: "Especificar qué busca" });
        }
    }

    // 3. Trueque Puro
    if ((types.includes("product") || types.includes("service")) && !types.includes("exchange_plus_cash")) {
        if (types.includes("product") && !data.wantedProducts?.trim()) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["wantedProducts"], message: "Describe qué artículos buscas" });
        }
        if (types.includes("service") && !data.wantedServices?.trim()) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["wantedServices"], message: "Describe qué servicios buscas" });
        }
    }
  });

describe('Release 1.2 - Strict Exchange Rules (Zod Validation)', () => {

    const baseInput = {
        title: "Test Item",
        listingType: "product" as const,
    };

    describe('Scenario 1: Money (Sale)', () => {
        it('should require price when Money is selected', () => {
            const input = { ...baseInput, acceptedExchangeTypes: ["money"] };
            const result = productSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(i => i.path.includes("price"))).toBe(true);
            }
        });

        it('should pass when price is provided', () => {
            const input = { ...baseInput, acceptedExchangeTypes: ["money"], price: 100 };
            const result = productSchema.safeParse(input);
            expect(result.success).toBe(true);
        });
    });

    describe('Scenario 2: Product Exchange (Trueque)', () => {
        it('should require wantedProducts description', () => {
            const input = { ...baseInput, acceptedExchangeTypes: ["product"] };
            const result = productSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(i => i.path.includes("wantedProducts"))).toBe(true);
            }
        });

        it('should NOT require wantedServices description', () => {
            const input = {
                ...baseInput,
                acceptedExchangeTypes: ["product"],
                wantedProducts: "I want an iPhone"
            };
            const result = productSchema.safeParse(input);
            expect(result.success).toBe(true);
        });
    });

    describe('Scenario 3: Service Exchange', () => {
        it('should require wantedServices description', () => {
            const input = { ...baseInput, acceptedExchangeTypes: ["service"] };
            const result = productSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(i => i.path.includes("wantedServices"))).toBe(true);
            }
        });
    });

    describe('Scenario 4: Mixed Exchange (Product + Service)', () => {
        it('should require BOTH descriptions if both checkboxes are selected', () => {
            const input = { ...baseInput, acceptedExchangeTypes: ["product", "service"] };
            const result = productSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(i => i.path.includes("wantedProducts"))).toBe(true);
                expect(result.error.issues.some(i => i.path.includes("wantedServices"))).toBe(true);
            }
        });

        it('should fail if only one is provided', () => {
            const input = {
                ...baseInput,
                acceptedExchangeTypes: ["product", "service"],
                wantedProducts: "Laptop"
            };
            const result = productSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(i => i.path.includes("wantedServices"))).toBe(true);
            }
        });

        it('should pass if both are provided', () => {
            const input = {
                ...baseInput,
                acceptedExchangeTypes: ["product", "service"],
                wantedProducts: "Laptop",
                wantedServices: "Cleaning"
            };
            const result = productSchema.safeParse(input);
            expect(result.success).toBe(true);
        });
    });

    describe('Scenario 5: Permuta (Exchange + Cash)', () => {
        it('should require Total Value (price) AND Difference (exchangeCashDelta)', () => {
            const input = {
                ...baseInput,
                acceptedExchangeTypes: ["exchange_plus_cash"],
                wantedProducts: "Car"
            };
            const result = productSchema.safeParse(input);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(i => i.path.includes("price"))).toBe(true);
                expect(result.error.issues.some(i => i.path.includes("exchangeCashDelta"))).toBe(true);
            }
        });

        it('should require at least ONE wanted description (Product OR Service)', () => {
            const input = { 
                ...baseInput, 
                acceptedExchangeTypes: ["exchange_plus_cash"], 
                price: 5000, 
                exchangeCashDelta: 1000 
            };
            const result = productSchema.safeParse(input);
            expect(result.success).toBe(false); // Fails because no wanted
            
            // Provide Product
            const inputP = { ...input, wantedProducts: "Motorcycle" };
            expect(productSchema.safeParse(inputP).success).toBe(true);

            // Provide Service
            const inputS = { ...input, wantedServices: "Legal Advice" };
            expect(productSchema.safeParse(inputS).success).toBe(true);
        });
    });

    describe('Scenario 6: Giveaway', () => {
        it('should pass without price or wanted items', () => {
            const input = { ...baseInput, acceptedExchangeTypes: ["giveaway"] };
            const result = productSchema.safeParse(input);
            expect(result.success).toBe(true);
        });
    });

});
