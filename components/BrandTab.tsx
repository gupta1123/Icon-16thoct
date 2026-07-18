"use client";

import type { VisitBrandPurchase } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Package, ShoppingCart, Tag } from "lucide-react";

interface BrandTabProps {
    brandPurchases?: VisitBrandPurchase[];
}

const hasValue = (value: unknown): boolean => {
    if (value == null) return false;
    return String(value).trim() !== "";
};

const displayValue = (value: unknown): string => {
    return hasValue(value) ? String(value).trim() : "—";
};

const formatSteelQuantity = (value: unknown): string => {
    if (!hasValue(value)) return "—";
    return `${String(value).trim()} tons`;
};

const getBrandName = (purchase: VisitBrandPurchase): string => {
    return (
        purchase.brandName ||
        purchase.primaryBrand ||
        purchase.localBrand ||
        ""
    ).trim();
};

export default function BrandTab({ brandPurchases = [] }: BrandTabProps) {
    const purchases = brandPurchases
        .filter((purchase) => getBrandName(purchase) || hasValue(purchase.category) || hasValue(purchase.purchasedFrom))
        .map((purchase, index) => ({
            ...purchase,
            id: purchase.id ?? index,
            brandName: getBrandName(purchase) || "Unnamed brand",
            steelQuantity: purchase.steelQuantity ?? purchase.steelQuantitySold ?? null,
        }));

    return (
        <div className="w-full">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">Brands & Materials</h3>
                        <Badge variant="secondary">{purchases.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Brand and material purchase details captured for this visit.
                    </p>
                </div>
            </div>

            {purchases.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-10 text-center">
                        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                            <Tag className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No brand or material details found</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Purchase details will appear here after they are captured for the visit.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {purchases.map((purchase, index) => (
                        <Card key={`${purchase.id}-${index}`} className="border bg-card">
                            <CardContent className="space-y-4 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-semibold text-foreground">{purchase.brandName}</h3>
                                            {hasValue(purchase.category) && (
                                                <Badge variant="secondary" className="uppercase tracking-wide">
                                                    {purchase.category}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <span className="inline-flex items-center gap-1">
                                                <ShoppingCart className="h-3 w-3" />
                                                Purchased from {displayValue(purchase.purchasedFrom)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="rounded-md border bg-muted/30 p-3">
                                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                            <Package className="h-3.5 w-3.5" />
                                            Steel Quantity
                                        </div>
                                        <p className="mt-1 text-sm font-medium text-foreground">
                                            {formatSteelQuantity(purchase.steelQuantity)}
                                        </p>
                                    </div>
                                    <div className="rounded-md border bg-muted/30 p-3">
                                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                            <Package className="h-3.5 w-3.5" />
                                            Cement Quantity
                                        </div>
                                        <p className="mt-1 text-sm font-medium text-foreground">
                                            {displayValue(purchase.cementQuantitySold)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
