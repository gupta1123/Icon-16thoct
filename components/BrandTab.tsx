"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, CheckCircle, XCircle, Loader2, ShoppingCart, Package, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Brand = {
    id: number;
    brandName: string;
    pros: string[];
    cons: string[];
    category?: string | null;
    purchasedFrom?: string | null;
    steelQuantitySold?: number | null;
    cementQuantitySold?: number | null;
};

type NewBrand = {
    brandName: string;
    pros: string[];
    cons: string[];
};

interface BrandTabProps {
    brands: Brand[];
    setBrands: React.Dispatch<React.SetStateAction<Brand[]>>;
    visitId: string;
    token: string | null;
    fetchVisitDetail: () => Promise<void>;
}

export default function BrandTab({ brands, setBrands, visitId, token, fetchVisitDetail }: BrandTabProps) {
    const [isAdding, setIsAdding] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [newBrand, setNewBrand] = useState<NewBrand>({
        brandName: "",
        pros: [],
        cons: [],
    });
    const [editingBrandId, setEditingBrandId] = useState<number | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
    const [brandToDelete, setBrandToDelete] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const fetchBrands = useCallback(async () => {
        try {
            const response = await fetch(`/api/proxy/visit/getProCons?visitId=${visitId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            const brandsData: Brand[] = (Array.isArray(data) ? data : [])?.map((brand: Partial<Brand>) => ({
                id: Number(brand.id ?? 0),
                brandName: String(brand.brandName ?? '').trim(),
                pros: Array.isArray(brand.pros) ? brand.pros.filter(Boolean) : [],
                cons: Array.isArray(brand.cons) ? brand.cons.filter(Boolean) : [],
                category: brand.category ?? null,
                purchasedFrom: brand.purchasedFrom ?? null,
                steelQuantitySold: brand.steelQuantitySold ?? null,
                cementQuantitySold: brand.cementQuantitySold ?? null,
            })) || [];
            setBrands(brandsData);
        } catch (error) {
            console.error("Error fetching brands:", error);
        }
    }, [token, visitId, setBrands]);

    useEffect(() => {
        if (visitId) {
            fetchBrands();
        }
    }, [visitId, fetchBrands]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewBrand({ ...newBrand, [e.target.name]: e.target.value });
    };

    const handleAddProCon = (type: "pros" | "cons") => {
        if (newBrand[type].length < 3) {
            setNewBrand({
                ...newBrand,
                [type]: [...newBrand[type], ""],
            });
        }
    };

    const handleProConChange = (
        type: "pros" | "cons",
        index: number,
        value: string
    ) => {
        const updatedProCon = [...newBrand[type]];
        updatedProCon[index] = value;
        setNewBrand({ ...newBrand, [type]: updatedProCon });
    };

    const handleAddBrand = async () => {
        if (newBrand.brandName.trim() !== "") {
            setIsSubmitting(true);
            const brand = {
                brandName: newBrand.brandName,
                pros: newBrand.pros.filter((pro) => pro.trim() !== ""),
                cons: newBrand.cons.filter((con) => con.trim() !== ""),
            };

            const allBrands = [...brands.map((b) => ({
                brandName: b.brandName,
                pros: b.pros,
                cons: b.cons,
            })), brand];

            try {
                const response = await fetch(`/api/proxy/visit/addProCons?visitId=${visitId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(allBrands),
                });

                if (response.ok) {
                    setNewBrand({ brandName: "", pros: [], cons: [] });
                    setIsAdding(false);
                    await fetchVisitDetail();
                    await fetchBrands();
                } else {
                    console.error("Error adding brand:", response.statusText);
                }
            } catch (error) {
                console.error("Error adding brand:", error);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleEditBrand = (brandId: number) => {
        setIsEditing(true);
        setEditingBrandId(brandId);
        const brand = brands.find((b) => b.id === brandId);
        if (brand) {
            setNewBrand({
                brandName: brand.brandName,
                pros: brand.pros,
                cons: brand.cons,
            });
        } else {
            console.error("Brand not found");
        }
    };

    const handleUpdateBrand = async () => {
        if (newBrand.brandName.trim() !== "") {
            setIsSubmitting(true);
            const updatedBrands = brands.map((brand) => {
                if (brand.id === editingBrandId) {
                    return {
                        ...brand,
                        brandName: newBrand.brandName,
                        pros: newBrand.pros.filter((pro) => pro.trim() !== ""),
                        cons: newBrand.cons.filter((con) => con.trim() !== ""),
                    };
                }
                return brand;
            });

            try {
                const response = await fetch(`/api/proxy/visit/addProCons?visitId=${visitId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(updatedBrands.map((brand) => ({
                        brandName: brand.brandName,
                        pros: brand.pros,
                        cons: brand.cons,
                    }))),
                });

                if (response.ok) {
                    setNewBrand({ brandName: "", pros: [], cons: [] });
                    setIsEditing(false);
                    setEditingBrandId(null);
                    await fetchVisitDetail();
                    await fetchBrands();
                } else {
                    console.error("Error updating brand:", response.statusText);
                }
            } catch (error) {
                console.error("Error updating brand:", error);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const openDeleteModal = (id: number) => {
        setBrandToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDeleteBrand = async () => {
        if (brandToDelete === null) return;

        const deletedBrand = brands.find((brand) => brand.id === brandToDelete);
        const updatedBrands = brands.filter((brand) => brand.id !== brandToDelete);

        if (deletedBrand) {
            try {
                const response = await fetch(`/api/proxy/visit/deleteProCons?visitId=${visitId}`, {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify([{ brandName: deletedBrand.brandName }]),
                });

                if (response.ok) {
                    console.log("Pros Cons Deleted Successfully!");
                    await fetchVisitDetail();
                    await fetchBrands();
                } else {
                    console.error("Error deleting brand:", response.statusText);
                }
            } catch (error) {
                console.error("Error deleting brand:", error);
            }
        }
        setShowDeleteModal(false);
        setBrandToDelete(null);
    };

    return (
        <div className="w-full">
            {/* Header */}
            {!isAdding && !isEditing && (
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-foreground">Brands</h3>
                            <Badge variant="secondary">{brands?.length ?? 0}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Pros/cons and purchase details captured for this visit.
                        </p>
                    </div>
                    {brands.length > 0 && (
                        <Button onClick={() => setIsAdding(true)} className="sm:w-auto">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Brand
                        </Button>
                    )}
                </div>
            )}

            {!isAdding && !isEditing && brands && brands.length === 0 && (
                <Card className="border-dashed">
                    <CardContent className="py-10 text-center">
                        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                            <Tag className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No brands added yet</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Add brands in use at this store and capture quick pros/cons.
                        </p>
                        <Button onClick={() => setIsAdding(true)} className="mt-4">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Brand
                        </Button>
                    </CardContent>
                </Card>
            )}

            {(isAdding || isEditing) && (
                <Card className="w-full mb-4 p-4">
                    <CardContent>
                        <div className="mb-4">
                            <Label>Brand Name</Label>
                            <Input
                                name="brandName"
                                value={newBrand.brandName}
                                onChange={handleInputChange}
                                placeholder="Enter brand name"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <Label>Pros</Label>
                                {newBrand.pros.map((pro, index) => (
                                    <Input
                                        key={index}
                                        value={pro}
                                        onChange={(e) => handleProConChange("pros", index, e.target.value)}
                                        placeholder={`Pro ${index + 1}`}
                                        className="mb-2"
                                    />
                                ))}
                                {newBrand.pros.length < 3 && (
                                    <Button
                                        onClick={() => handleAddProCon("pros")}
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                    >
                                        <Plus className="mr-2" />
                                        Add Pro
                                    </Button>
                                )}
                            </div>
                            <div>
                                <Label>Cons</Label>
                                {newBrand.cons.map((con, index) => (
                                    <Input
                                        key={index}
                                        value={con}
                                        onChange={(e) => handleProConChange("cons", index, e.target.value)}
                                        placeholder={`Con ${index + 1}`}
                                        className="mb-2"
                                    />
                                ))}
                                {newBrand.cons.length < 3 && (
                                    <Button
                                        onClick={() => handleAddProCon("cons")}
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                    >
                                        <Plus className="mr-2" />
                                        Add Con
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <Button
                                onClick={isEditing ? handleUpdateBrand : handleAddBrand}
                                variant="default"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {isEditing ? "Updating..." : "Adding..."}
                                    </>
                                ) : (
                                    isEditing ? "Update" : "Add"
                                )}
                            </Button>
                            <Button
                                onClick={() => {
                                    setIsAdding(false);
                                    setIsEditing(false);
                                    setEditingBrandId(null);
                                    setNewBrand({ brandName: "", pros: [], cons: [] });
                                }}
                                variant="outline"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {brands.length > 0 && (
                <div className="mt-8 grid grid-cols-1 gap-4">
                    {brands.map((brand) => (
                        <Card
                            key={brand.id}
                            className="w-full p-4 h-full overflow-hidden border bg-card"
                        >
                            <CardContent className="w-full space-y-4 p-0">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-semibold text-foreground">{brand.brandName}</h3>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            {brand.category && (
                                                <Badge variant="secondary" className="uppercase tracking-wide">
                                                    {brand.category}
                                                </Badge>
                                            )}
                                            {brand.purchasedFrom && (
                                                <span className="inline-flex items-center gap-1">
                                                    <ShoppingCart className="h-3 w-3" />
                                                    Purchased from {brand.purchasedFrom}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditBrand(brand.id)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => openDeleteModal(brand.id)}>
                                            <Trash className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                                        <div className="flex items-center gap-2 font-semibold text-foreground">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            Pros
                                            <Badge variant="outline" className="ml-auto text-[11px]">{brand.pros.length}</Badge>
                                        </div>
                                        {brand.pros.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {brand.pros.map((pro, index) => (
                                                    <Badge key={index} variant="secondary" className="font-normal">
                                                        {pro}
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs italic text-muted-foreground">No pros recorded.</p>
                                        )}
                                    </div>
                                    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                                        <div className="flex items-center gap-2 font-semibold text-foreground">
                                            <XCircle className="h-4 w-4 text-red-600" />
                                            Cons
                                            <Badge variant="outline" className="ml-auto text-[11px]">{brand.cons.length}</Badge>
                                        </div>
                                        {brand.cons.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {brand.cons.map((con, index) => (
                                                    <Badge key={index} variant="secondary" className="font-normal">
                                                        {con}
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs italic text-muted-foreground">No cons recorded.</p>
                                        )}
                                    </div>
                                </div>

                                {(brand.steelQuantitySold != null || brand.cementQuantitySold != null) && (
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border rounded-md p-3 bg-muted/30">
                                        {brand.steelQuantitySold != null && (
                                            <span className="inline-flex items-center gap-1">
                                                <Package className="h-3 w-3" />
                                                Steel Qty: {brand.steelQuantitySold}
                                            </span>
                                        )}
                                        {brand.cementQuantitySold != null && (
                                            <span className="inline-flex items-center gap-1">
                                                <Package className="h-3 w-3" />
                                                Cement Qty: {brand.cementQuantitySold}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add button is in the header when not editing/adding */}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <Card className="w-full max-w-md border-0 shadow-lg">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-foreground mb-4">Delete Brand</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Are you sure you want to delete this brand? This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setBrandToDelete(null);
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleDeleteBrand}
                                >
                                    Delete
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
