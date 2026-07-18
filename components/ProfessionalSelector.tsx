"use client";

import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProfessionalDto } from "@/lib/api";

const formatValue = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const getProfessionalName = (professional: ProfessionalDto): string => {
  return formatValue(professional.name) || "Unnamed professional";
};

const getProfessionalMeta = (professional: Pick<ProfessionalDto, "contact" | "city">): string => {
  return [formatValue(professional.contact), formatValue(professional.city)].filter(Boolean).join(" · ");
};

interface ProfessionalSelectorProps {
  professionals: ProfessionalDto[];
  value?: number | null;
  onChange: (professional: ProfessionalDto | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  legacyName?: string | null;
  legacyContact?: string | number | null;
  legacyCity?: string | null;
  className?: string;
}

export function ProfessionalSelector({
  professionals,
  value,
  onChange,
  isLoading = false,
  disabled = false,
  placeholder = "Select professional",
  searchPlaceholder = "Search by name, contact, or city",
  emptyMessage = "No professionals found",
  legacyName,
  legacyContact,
  legacyCity,
  className,
}: ProfessionalSelectorProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedProfessional = useMemo(
    () => professionals.find((professional) => professional.id === value) ?? null,
    [professionals, value],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProfessionals = useMemo(() => {
    if (!normalizedQuery) return professionals;
    return professionals.filter((professional) => {
      const searchable = [
        professional.name,
        professional.contact,
        professional.city,
        professional.role,
      ]
        .map(formatValue)
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [professionals, normalizedQuery]);

  const selectedMeta = selectedProfessional ? getProfessionalMeta(selectedProfessional) : "";
  const legacyMeta = getProfessionalMeta({ contact: legacyContact, city: legacyCity });
  const displayValue = query || (selectedProfessional ? getProfessionalName(selectedProfessional) : "");

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setIsOpen(true);
    if (selectedProfessional) {
      onChange(null);
    }
  };

  const handleSelect = (professional: ProfessionalDto) => {
    onChange(professional);
    setQuery(getProfessionalName(professional));
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Input
          value={displayValue}
          placeholder={selectedProfessional ? placeholder : searchPlaceholder}
          disabled={disabled}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 120);
          }}
          className={selectedProfessional ? "pr-9" : undefined}
        />
        {selectedProfessional && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClear}
            aria-label="Clear professional selection"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {selectedProfessional && selectedMeta && (
        <p className="text-xs text-muted-foreground">{selectedMeta}</p>
      )}

      {!selectedProfessional && legacyName && (
        <p className="text-xs text-amber-700">
          Legacy engineer: {legacyName}
          {legacyMeta ? ` · ${legacyMeta}` : ""}. Select an existing engineer to link contact details.
        </p>
      )}

      {isOpen && !disabled && (
        <div className="max-h-44 w-full overflow-y-auto rounded-md border bg-background p-1 shadow-sm">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Loading engineers...</div>
          ) : filteredProfessionals.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</div>
          ) : (
            filteredProfessionals.map((professional) => {
              const meta = getProfessionalMeta(professional);
              const isSelected = professional.id === value;
              return (
                <button
                  key={professional.id}
                  type="button"
                  className={cn(
                    "w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted",
                    isSelected && "bg-muted",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(professional)}
                >
                  <span className="block font-medium">{getProfessionalName(professional)}</span>
                  {meta && <span className="block text-xs text-muted-foreground">{meta}</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
