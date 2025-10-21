"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

interface PricingCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PricingData {
  brandName: string;
  price: number;
  city: string;
}

export default function PricingCheckModal({ isOpen, onClose, onSuccess }: PricingCheckModalProps) {
  const { token, userData } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricingData, setPricingData] = useState<PricingData>({
    brandName: "Icon Steel",
    price: 0,
    city: ""
  });

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setPricingData({
        brandName: "Icon Steel",
        price: 0,
        city: ""
      });
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Authentication token not available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        brandName: pricingData.brandName,
        price: pricingData.price,
        employeeDto: {
          id: userData?.employeeId || 1
        },
        city: pricingData.city,
        state: "Maharashtra",
        district: "Default",
        subDistrict: "Default"
      };

      console.log('Creating pricing with payload:', payload);

      const response = await fetch('/api/proxy/brand/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create pricing: ${response.status} ${errorText}`);
      }

      const result = await response.text();
      console.log('Pricing created successfully:', result);
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating pricing:', err);
      setError(err instanceof Error ? err.message : 'Failed to create pricing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof PricingData, value: string | number) => {
    setPricingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Set Today&apos;s Pricing
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              ×
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            No pricing found for Icon Steel today. Please set the pricing to continue.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand Name</Label>
              <Input
                id="brandName"
                value={pricingData.brandName}
                onChange={(e) => handleInputChange('brandName', e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={pricingData.price}
                onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                required
                disabled={isLoading}
                placeholder="Enter price"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={pricingData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                required
                disabled={isLoading}
                placeholder="Enter city"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Pricing'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
