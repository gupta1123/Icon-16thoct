"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { 
  Building2, 
  Camera, 
  Check, 
  Loader2, 
  LocateFixed, 
  MapPin, 
  Plus, 
  Users, 
  X,
  Store,
  Building,
  HardHat,
  Compass,
  Wrench,
  User,
  Phone,
  Mail,
  CheckCircle2,
  Sparkles,
  Navigation,
  ArrowRight,
  Search,
  Package,
  Layers,
  FileCheck,
  AlertCircle
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API, type DistrictDto, type ProfessionalDto, type StateDto } from "@/lib/api";

const API_BASE = "https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net";

const CUSTOMER_TYPES = [
  { value: "Dealer/Shop", label: "Dealer / Shop", desc: "Retailer or distributor", icon: Store },
  { value: "Site Visit", label: "Site Visit", desc: "Construction project", icon: Building },
  { value: "Engineer", label: "Engineer", desc: "Civil or Structural", icon: HardHat },
  { value: "Architect", label: "Architect", desc: "Design & Planning", icon: Compass },
  { value: "Contractor", label: "Contractor", desc: "Building contractor", icon: Wrench },
] as const;

const PRODUCT_OPTIONS: Record<string, Array<{ label: string; value: string }>> = {
  "Dealer/Shop": [
    { label: "Steel", value: "steel" },
    { label: "Cement", value: "cement" },
    { label: "Plumbing", value: "plumbing" },
    { label: "Paints", value: "paints" },
    { label: "Tiles", value: "tiles" },
  ],
  "Site Visit": [
    { label: "Cement Use", value: "cement_use" },
    { label: "Steel Use", value: "steel_use" },
  ],
  Engineer: [
    { label: "Planner", value: "planner" },
    { label: "Designer", value: "designer" },
    { label: "Valuers", value: "valuers" },
    { label: "Structure", value: "structure" },
    { label: "Arch and Structure Both", value: "arch_and_structure_both" },
    { label: "Civil Engineer", value: "civil_engineer" },
  ],
  Architect: [
    { label: "Planner", value: "planner" },
    { label: "Designer", value: "designer" },
    { label: "Valuers", value: "valuers" },
    { label: "Structure", value: "structure" },
    { label: "Arch and Structure Both", value: "arch_and_structure_both" },
    { label: "Civil Engineer", value: "civil_engineer" },
  ],
  Contractor: [{ label: "With Material", value: "withMaterial" }],
};

const VISIT_PURPOSE: Record<string, string> = {
  "Dealer/Shop": "Monthly Visit",
  "Site Visit": "Order",
  Engineer: "First Visit",
  Architect: "First Visit",
  Contractor: "First Visit",
};

interface NearbyStore {
  storeId: number;
  storeName?: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientType?: string;
  city?: string;
  primaryContact?: string | number;
  distance?: number;
  distanceInMeters?: number;
}

interface CustomerFormState {
  clientType: string;
  storeName: string;
  clientName: string;
  primaryContact: string;
  dateOfBirth: string;
  email: string;
  state: string;
  district: string;
  taluka: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
  pincode: string;
  latitude: string;
  longitude: string;
  shopAgeYears: string;
  stock: string;
  ownershipType: string;
  dealerType: string;
  dealerSubType: string;
  yearsOfExperience: string;
  laborRate: string;
  engineerId: string;
  engineerName: string;
  contractorId: string;
  contractorName: string;
  projectType: string;
  projectSize: string;
}

const EMPTY_FORM: CustomerFormState = {
  clientType: "",
  storeName: "",
  clientName: "",
  primaryContact: "",
  dateOfBirth: "",
  email: "",
  state: "",
  district: "",
  taluka: "",
  city: "",
  addressLine1: "",
  addressLine2: "",
  pincode: "",
  latitude: "",
  longitude: "",
  shopAgeYears: "",
  stock: "",
  ownershipType: "",
  dealerType: "",
  dealerSubType: "",
  yearsOfExperience: "",
  laborRate: "",
  engineerId: "",
  engineerName: "",
  contractorId: "",
  contractorName: "",
  projectType: "",
  projectSize: "",
};

interface CreateCustomerFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  employeeId: number | null;
  onCustomerAdded?: () => void;
}

const splitName = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
};

const parseCreatedId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return parseCreatedId(record.id ?? record.storeId ?? record.visitId ?? record.data);
  }
  return null;
};

const authHeaders = (token: string, json = true): HeadersInit => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  Authorization: `Bearer ${token}`,
});

export default function CreateCustomerFlowModal({
  isOpen,
  onClose,
  token,
  employeeId,
  onCustomerAdded,
}: CreateCustomerFlowModalProps) {
  const router = useRouter();
  const [stage, setStage] = useState<"nearby" | "form">("form");
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [states, setStates] = useState<StateDto[]>([]);
  const [districts, setDistricts] = useState<DistrictDto[]>([]);
  const [selectedStateId, setSelectedStateId] = useState<number | null>(null);
  const [professionals, setProfessionals] = useState<ProfessionalDto[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [customProduct, setCustomProduct] = useState("");
  const [customProducts, setCustomProducts] = useState<string[]>([]);
  const [nearbyStores, setNearbyStores] = useState<NearbyStore[]>([]);
  const [radius, setRadius] = useState(100);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [checkInImage, setCheckInImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isDealer = form.clientType === "Dealer/Shop";
  const isSiteVisit = form.clientType === "Site Visit";
  const isProfessional = ["Engineer", "Architect", "Contractor"].includes(form.clientType);
  const isContractor = form.clientType === "Contractor";
  const productOptions = PRODUCT_OPTIONS[form.clientType] || [];

  const update = (field: keyof CustomerFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const fetchNearby = useCallback(async (latitude: number, longitude: number, nextRadius: number) => {
    setIsLoadingNearby(true);
    try {
      const response = await fetch(
        `${API_BASE}/store/getByLocation?latitude=${latitude}&longitude=${longitude}&radiusInMeters=${nextRadius}`,
        { headers: authHeaders(token, false) }
      );
      if (response.status === 404) {
        setNearbyStores([]);
        return;
      }
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const stores = Array.isArray(data) ? (data as NearbyStore[]) : [];
      setNearbyStores(Array.from(new Map(stores.map((store) => [store.storeId, store])).values()));
    } catch (error) {
      console.error("Unable to load nearby stores", error);
      setNearbyStores([]);
      setLocationMessage("Location was captured, but nearby stores could not be loaded.");
    } finally {
      setIsLoadingNearby(false);
    }
  }, [token]);

  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
        { headers: { Accept: "application/json" } }
      );
      if (!response.ok) return;
      const data = await response.json();
      const address = data?.address || {};
      setForm((current) => ({
        ...current,
        addressLine1: current.addressLine1 || [address.road, address.neighbourhood].filter(Boolean).join(", "),
        addressLine2: current.addressLine2 || address.suburb || "",
        city: current.city || address.city || address.town || address.village || "",
        district: current.district || address.state_district || address.county || "",
        taluka: current.taluka || address.subdistrict || address.city_district || address.village || "",
        state: current.state || address.state || "",
        pincode: current.pincode || address.postcode || "",
      }));
    } catch (error) {
      console.warn("Reverse geocoding unavailable", error);
    }
  }, []);

  const captureLocation = useCallback((loadNearby = false) => {
    if (!navigator.geolocation) {
      setLocationMessage("Geolocation is not supported by this browser.");
      return;
    }
    setIsLocating(true);
    setLocationMessage(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = coords.latitude;
        const longitude = coords.longitude;
        setForm((current) => ({ ...current, latitude: String(latitude), longitude: String(longitude) }));
        await reverseGeocode(latitude, longitude);
        if (loadNearby) await fetchNearby(latitude, longitude, radius);
        setIsLocating(false);
      },
      (error) => {
        setLocationMessage(error.message || "Location permission is required to find nearby stores.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [fetchNearby, radius, reverseGeocode]);

  useEffect(() => {
    if (!isOpen) return;
    setForm(EMPTY_FORM);
    setErrors({});
    setProducts([]);
    setCustomProducts([]);
    setCustomProduct("");
    setNearbyStores([]);
    setLocationMessage(null);
    setCheckInImage(null);
    setSubmitError(null);
    setStage("form");
    captureLocation(false);
  }, [isOpen, captureLocation]);

  useEffect(() => {
    if (!isOpen) return;
    API.getAllStates()
      .then(setStates)
      .catch((error) => console.error("Error fetching states:", error));
  }, [isOpen]);

  useEffect(() => {
    if (!selectedStateId) {
      setDistricts([]);
      return;
    }
    API.getDistrictsByStateId(selectedStateId)
      .then(setDistricts)
      .catch((error) => console.error("Error fetching districts:", error));
  }, [selectedStateId]);

  useEffect(() => {
    if (!isOpen || !token) return;
    API.getAllProfessionals()
      .then(setProfessionals)
      .catch((error) => console.error("Error fetching professionals:", error));
  }, [isOpen, token]);

  const engineerOptions = useMemo(
    () => professionals.filter((p) => (p.role ?? "").toLowerCase().includes("engineer")),
    [professionals]
  );
  const contractorOptions = useMemo(
    () => professionals.filter((p) => (p.role ?? "").toLowerCase().includes("contractor")),
    [professionals]
  );

  const validate = (startVisitImmediately = false) => {
    const next: Record<string, string> = {};
    if (!form.clientType) next.clientType = "Select a customer type";
    if (!isSiteVisit && !isContractor && !form.storeName.trim()) next.storeName = "Name is required";
    if (!form.clientName.trim()) next.clientName = "Owner name is required";

    if (form.primaryContact && !/^\d{10}$/.test(form.primaryContact)) {
      next.primaryContact = "Primary contact must be 10 digits";
    }

    if (!form.state) next.state = "Select state";
    if (!form.district) next.district = "Select district";
    if (!form.taluka.trim()) next.taluka = "Taluka/Village is required";
    if (!form.city.trim()) next.city = "City is required";

    if (!form.latitude || !form.longitude) {
      next.latitude = "Capture GPS coordinates";
    }

    if (isDealer) {
      if (!form.shopAgeYears) next.shopAgeYears = "Shop age is required";
      if (!form.ownershipType) next.ownershipType = "Select ownership";
      if (!form.dealerType) next.dealerType = "Select dealer type";
      if (form.dealerType === "ICON" && !form.dealerSubType) next.dealerSubType = "Select subtype";
    }

    if (isProfessional && !isContractor) {
      if (!form.dateOfBirth) next.dateOfBirth = "Date of birth is required";
      if (!form.email.trim()) next.email = "Email is required";
      if (!form.yearsOfExperience) next.yearsOfExperience = "Experience is required";
    }

    if (startVisitImmediately && !checkInImage) {
      next.checkInImage = "Check-in photo is required";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildStorePayload = () => {
    const { firstName, lastName } = splitName(form.clientName);
    const storeName = form.storeName.trim() || `${form.clientName.trim()} ${form.clientType}`.trim();
    const categories = products.map((item) => item.toLowerCase().replace(/\s+/g, "_"));

    const payload: Record<string, unknown> = {
      clientType: form.clientType,
      storeName,
      clientFirstName: firstName,
      clientLastName: lastName,
      state: form.state,
      district: form.district,
      subDistrict: form.taluka,
      city: form.city,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      employeeId: employeeId ?? null,
    };

    if (form.primaryContact) payload.primaryContact = Number(form.primaryContact);
    if (form.pincode) payload.pincode = Number(form.pincode);
    if (form.dateOfBirth) payload.dateOfBirth = form.dateOfBirth;

    if (isDealer) {
      if (form.shopAgeYears) payload.shopAgeYears = Number(form.shopAgeYears);
      if (form.stock) {
        payload.stock = Number(form.stock);
        payload.monthlySale = Number(form.stock);
      }
      if (form.ownershipType) payload.ownershipType = form.ownershipType;
      if (form.dealerType) payload.dealerType = form.dealerType;
      if (form.dealerType === "ICON" && form.dealerSubType) payload.dealerSubType = form.dealerSubType;
      if (categories.length) payload.productCategories = categories;
    }

    if (isSiteVisit) {
      if (form.engineerId) payload.engineerId = Number(form.engineerId);
      if (form.engineerName) payload.engineerName = form.engineerName;
      if (form.contractorId) payload.contractorId = Number(form.contractorId);
      if (form.contractorName) payload.contractorName = form.contractorName;
      if (form.projectType) payload.projectType = form.projectType;
      if (form.projectSize) payload.projectSizeSquareFeet = Number(form.projectSize);
    }
    return payload;
  };

  const createStore = async () => {
    const response = await fetch(`${API_BASE}/store/create`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(buildStorePayload()),
    });
    const raw = await response.text();
    let data: unknown = raw;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* plain numeric response */ }
    if (!response.ok) throw new Error(typeof data === "string" ? data : "Customer creation failed");
    const id = parseCreatedId(data);
    if (!id) throw new Error("Customer was created but no customer ID was returned");
    return id;
  };

  const createProfessional = async (storeId: number) => {
    if (!isProfessional) return null;
    const body: Record<string, unknown> = {
      name: form.clientName.trim(),
      role: form.clientType.toLowerCase(),
      storeId,
    };
    if (form.primaryContact) body.contact = form.primaryContact;
    if (form.city) body.city = form.city;
    if (form.email) body.email = form.email;
    if (form.dateOfBirth) body.dateOfBirth = form.dateOfBirth;
    if (form.yearsOfExperience) body.experience = `${form.yearsOfExperience} years`;
    if (isContractor) {
      body.withMaterial = String(products.includes("withMaterial"));
      body.laborRate = form.laborRate ? Number(form.laborRate) : 0;
    }
    const response = await fetch(`${API_BASE}/professionals/addForStore`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await response.text());
    return response;
  };

  const createVisit = async (storeId: number) => {
    const response = await fetch(`${API_BASE}/visit/create`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({
        storeId,
        employeeId,
        visit_date: format(new Date(), "yyyy-MM-dd"),
        purpose: VISIT_PURPOSE[form.clientType] || "First Visit",
        priority: "HIGH",
        visitLatitude: Number(form.latitude),
        visitLongitude: Number(form.longitude),
      }),
    });
    const raw = await response.text();
    let data: unknown = raw;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* plain response */ }
    if (!response.ok) throw new Error(typeof data === "string" ? data : "Visit creation failed");
    const id = parseCreatedId(data);
    if (!id) throw new Error("Visit was created but no visit ID was returned");
    return id;
  };

  const startCreatedVisit = async (visitId: number) => {
    if (!checkInImage) throw new Error("Select a check-in photo");
    const upload = new FormData();
    upload.append("file", checkInImage);
    const uploadResponse = await fetch(`${API_BASE}/visit/uploadFile?id=${visitId}&tag=check-in`, {
      method: "PUT",
      headers: authHeaders(token, false),
      body: upload,
    });
    if (!uploadResponse.ok) throw new Error(await uploadResponse.text());
    const checkInResponse = await fetch(`${API_BASE}/visit/checkin?id=${visitId}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ checkinLatitude: Number(form.latitude), checkinLongitude: Number(form.longitude) }),
    });
    if (!checkInResponse.ok) throw new Error(await checkInResponse.text());
  };

  const submit = async (withVisit: boolean) => {
    const startVisit = withVisit && isSiteVisit;
    if (!validate(startVisit)) return;
    setIsSubmitting(true);
    setSubmitError(null);
    let storeId: number | null = null;
    try {
      if (startVisit && employeeId != null) {
        setProgress("Checking active visits…");
        const today = format(new Date(), "yyyy-MM-dd");
        const response = await fetch(`${API_BASE}/visit/getByDateRangeAndEmployee?id=${employeeId}&start=${today}&end=${today}`, { headers: authHeaders(token, false) });
        if (response.ok) {
          const visits = await response.json();
          if (Array.isArray(visits) && visits.some((visit) => visit?.checkinDate && !visit?.checkoutDate)) {
            throw new Error("Complete ongoing visit before starting another one.");
          }
        }
      }

      setProgress("Creating customer…");
      storeId = await createStore();
      let professionalWarning = "";
      if (isProfessional) {
        setProgress("Creating professional profile…");
        try { await createProfessional(storeId); } catch (error) {
          professionalWarning = error instanceof Error ? error.message : "Professional profile could not be created";
        }
      }

      if (!withVisit) {
        if (professionalWarning) window.alert(`Customer created, but professional profile failed: ${professionalWarning}`);
        onCustomerAdded?.();
        onClose();
        router.push(`/dashboard/customers/${storeId}`);
        return;
      }

      try {
        setProgress("Creating visit…");
        const visitId = await createVisit(storeId);
        if (startVisit) {
          setProgress("Uploading check-in photo…");
          await startCreatedVisit(visitId);
        }
        if (professionalWarning) window.alert(`Customer and visit created, but professional profile failed: ${professionalWarning}`);
        onCustomerAdded?.();
        onClose();
        router.push(`/dashboard/visits/${visitId}`);
      } catch (visitError) {
        const message = visitError instanceof Error ? visitError.message : "Visit creation failed";
        window.alert(`Customer created successfully, but visit creation failed: ${message}`);
        onCustomerAdded?.();
        onClose();
        router.push(`/dashboard/customers/${storeId}`);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Customer creation failed");
    } finally {
      setIsSubmitting(false);
      setProgress("");
    }
  };

  const fieldError = (field: string) => errors[field] ? <p className="mt-1 text-xs font-semibold text-destructive">{errors[field]}</p> : null;

  const sectionLinks: Array<[string, string]> = [
    ["customer-type", "Category"],
    ["basic-info", "Basic Info"],
    ["location-details", "Location"],
  ];
  if (form.clientType) {
    sectionLinks.push(["specific-details", isDealer ? "Dealer Specs" : isSiteVisit ? "Project Specs" : "Professional Specs"]);
    sectionLinks.push(["products", "Product Mix"]);
  }
  if (isSiteVisit) sectionLinks.push(["check-in", "Check-in"]);
  sectionLinks.push(["finish", "Submit"]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-4xl border border-border/80 bg-background rounded-2xl shadow-2xl">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-border/40 bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center font-bold shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                {stage === "nearby" ? "Check Nearby Customers" : "Create New Customer"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {stage === "nearby" 
                  ? "Check nearby registered stores to avoid duplicate entries" 
                  : "Fill customer details & location parameters"}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* STAGE 1: NEARBY STORES CHECK */}
        {stage === "nearby" ? (
          <div className="flex max-h-[80vh] flex-col">
            {/* Radius Filters Bar */}
            <div className="flex items-center justify-between border-b border-border/40 px-6 py-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground mr-1">Filter Radius:</span>
                {[50, 100, 1000].map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={radius === value ? "default" : "outline"}
                    onClick={() => {
                      setRadius(value);
                      if (form.latitude && form.longitude) fetchNearby(Number(form.latitude), Number(form.longitude), value);
                    }}
                    className={`h-8 text-xs font-semibold rounded-lg ${
                      radius === value 
                        ? "bg-foreground text-background font-bold" 
                        : "border-border/80 hover:bg-muted"
                    }`}
                  >
                    {value === 1000 ? "1 km" : `${value} m`}
                  </Button>
                ))}
              </div>

              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => captureLocation(true)} 
                disabled={isLocating}
                className="h-8 text-xs font-medium rounded-lg border-border/80 hover:bg-foreground hover:text-background gap-1.5"
              >
                <LocateFixed className={`h-3.5 w-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                {isLocating ? "Locating..." : "Refresh GPS"}
              </Button>
            </div>

            {locationMessage && (
              <div className="px-6 py-2 bg-muted/40 text-[11px] font-medium text-foreground border-b border-border/30 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{locationMessage}</span>
              </div>
            )}

            <div className="min-h-64 flex-1 overflow-y-auto p-6">
              {isLocating || isLoadingNearby ? (
                <div className="flex h-56 flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                  <span>Scanning nearby customers near your coordinates...</span>
                </div>
              ) : nearbyStores.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center text-center text-muted-foreground space-y-3">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="h-6 w-6 opacity-40 text-foreground" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">No nearby stores detected</p>
                    <p className="text-xs text-muted-foreground pt-0.5">No registered customers within {radius === 1000 ? "1 km" : `${radius}m`}.</p>
                  </div>
                  <Button 
                    onClick={() => setStage("form")}
                    className="h-9 px-4 text-xs font-bold rounded-xl bg-foreground text-background hover:bg-foreground/90 gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Create New Customer
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {nearbyStores.map((store) => (
                    <div 
                      key={store.storeId} 
                      className="group rounded-xl border border-border/70 bg-card p-4 text-left hover:border-foreground/50 hover:shadow-xs transition-all cursor-pointer space-y-2"
                      onClick={() => { onClose(); router.push(`/dashboard/customers/${store.storeId}`); }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                            {store.storeName || "Unnamed Customer"}
                          </h4>
                          <p className="text-[11px] text-muted-foreground pt-0.5">
                            {[store.clientFirstName, store.clientLastName].filter(Boolean).join(" ") || store.primaryContact || "No contact"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-semibold bg-muted border-border/60 text-foreground">
                          {store.clientType || "Customer"}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span>{store.city || "Location set"}</span>
                        </div>
                        {Number.isFinite(store.distanceInMeters ?? store.distance) && (
                          <span className="font-semibold text-foreground">
                            {Math.round(store.distanceInMeters ?? store.distance ?? 0)} m away
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border/40 p-4 bg-card">
              <Button variant="outline" size="sm" onClick={onClose} className="h-9 text-xs font-medium rounded-xl border-border/80">
                Cancel
              </Button>
              <Button onClick={() => setStage("form")} size="sm" className="h-9 text-xs font-bold rounded-xl bg-foreground text-background hover:bg-foreground/90 gap-1.5">
                <Plus className="h-4 w-4" /> Continue to Form
              </Button>
            </div>
          </div>
        ) : (
          /* STAGE 2: FORM FLOW */
          <div className="flex max-h-[80vh] flex-col">
            {/* Quick Section Navigation Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/40 bg-muted/30 px-6 py-2.5">
              {sectionLinks.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => document.getElementById(`create-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-lg transition-all whitespace-nowrap"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {submitError && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-medium text-destructive flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* 1. CUSTOMER TYPE CARD GRID */}
              <section id="create-customer-type" className="scroll-mt-4 rounded-2xl border border-border/80 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">1. Select Customer Category *</h3>
                    <p className="text-[11px] text-muted-foreground">Select customer role to load specific fields</p>
                  </div>
                </div>

                <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-5">
                  {CUSTOMER_TYPES.map((type) => {
                    const IconComp = type.icon;
                    const isSelected = form.clientType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => { update("clientType", type.value); setProducts([]); }}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? "border-2 border-foreground bg-foreground text-background shadow-md shadow-foreground/5 scale-[1.01]"
                            : "border-border/70 bg-background text-foreground hover:border-foreground/40 hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${isSelected ? "bg-background/20 text-background" : "bg-muted text-foreground"}`}>
                            <IconComp className="w-3.5 h-3.5" />
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] text-background shrink-0" />}
                        </div>
                        <div>
                          <p className={`text-xs font-bold leading-tight ${isSelected ? "text-background" : "text-foreground"}`}>
                            {type.label}
                          </p>
                          <p className={`text-[10px] pt-0.5 leading-tight line-clamp-1 ${isSelected ? "text-background/80" : "text-muted-foreground"}`}>
                            {type.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {fieldError("clientType")}
              </section>

              {/* 2. BASIC INFORMATION */}
              <section id="create-basic-info" className="scroll-mt-4 rounded-2xl border border-border/80 bg-card p-4 space-y-4">
                <div className="border-b border-border/40 pb-2">
                  <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">2. Basic Information</h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      {isSiteVisit ? "Project Name (Optional)" : isContractor ? "Firm Name (Optional)" : isDealer ? "Shop Name *" : "Firm Name *"}
                    </Label>
                    <div className="relative">
                      <Store className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                      <Input 
                        value={form.storeName} 
                        onChange={(e) => update("storeName", e.target.value)} 
                        className="h-10 text-xs pl-9 rounded-xl border-border/80 bg-background"
                        placeholder="Business / Firm name"
                      />
                    </div>
                    {fieldError("storeName")}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      {isSiteVisit ? "Site Owner Name *" : "Owner Name *"}
                    </Label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                      <Input 
                        value={form.clientName} 
                        onChange={(e) => update("clientName", e.target.value)} 
                        className="h-10 text-xs pl-9 rounded-xl border-border/80 bg-background"
                        placeholder="Owner full name"
                      />
                    </div>
                    {fieldError("clientName")}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Primary Contact Phone</Label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                      <Input 
                        inputMode="numeric" 
                        maxLength={10} 
                        value={form.primaryContact} 
                        onChange={(e) => update("primaryContact", e.target.value.replace(/\D/g, "").slice(0, 10))} 
                        className="h-10 text-xs pl-9 rounded-xl border-border/80 bg-background"
                        placeholder="10 digit contact"
                      />
                    </div>
                    {fieldError("primaryContact")}
                  </div>

                  {(isDealer || isSiteVisit) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">
                        {isSiteVisit ? "Site Owner Date of Birth (Optional)" : "Owner Date of Birth (Optional)"}
                      </Label>
                      <Input 
                        type="date" 
                        value={form.dateOfBirth} 
                        onChange={(e) => update("dateOfBirth", e.target.value)} 
                        className="h-10 text-xs rounded-xl border-border/80 bg-background"
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* 3. LOCATION DETAILS */}
              <section id="create-location-details" className="scroll-mt-4 rounded-2xl border border-border/80 bg-card p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div>
                    <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">3. Location & Address</h3>
                  </div>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline" 
                    onClick={() => captureLocation(false)} 
                    disabled={isLocating}
                    className="h-8 text-xs font-bold rounded-xl border-border/80 hover:bg-foreground hover:text-background gap-1.5"
                  >
                    <LocateFixed className={`h-3.5 w-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                    {isLocating ? "Capturing..." : "Capture GPS Location"}
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">State *</Label>
                    <Select value={selectedStateId?.toString() || ""} onValueChange={(value) => { const id = Number(value); setSelectedStateId(id); update("state", states.find((item) => item.id === id)?.stateName || ""); update("district", ""); }}>
                      <SelectTrigger className="h-10 text-xs rounded-xl border-border/80 bg-background">
                        <SelectValue placeholder={form.state || "Select state"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {states.map((item) => <SelectItem key={item.id} value={String(item.id)} className="text-xs">{item.stateName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {fieldError("state")}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">District *</Label>
                    <Select value={form.district} onValueChange={(value) => update("district", value)} disabled={!selectedStateId}>
                      <SelectTrigger className="h-10 text-xs rounded-xl border-border/80 bg-background">
                        <SelectValue placeholder={form.district || "Select district"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {districts.map((item) => <SelectItem key={item.id} value={item.districtName} className="text-xs">{item.districtName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {fieldError("district")}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Taluka / Village *</Label>
                    <Input value={form.taluka} onChange={(e) => update("taluka", e.target.value)} className="h-10 text-xs rounded-xl border-border/80 bg-background" placeholder="Taluka name" />
                    {fieldError("taluka")}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">City *</Label>
                    <Input value={form.city} onChange={(e) => update("city", e.target.value)} className="h-10 text-xs rounded-xl border-border/80 bg-background" placeholder="City name" />
                    {fieldError("city")}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Address Line 1</Label>
                    <Input value={form.addressLine1} onChange={(e) => update("addressLine1", e.target.value)} className="h-10 text-xs rounded-xl border-border/80 bg-background" placeholder="Building/Street address" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Address Line 2</Label>
                    <Input value={form.addressLine2} onChange={(e) => update("addressLine2", e.target.value)} className="h-10 text-xs rounded-xl border-border/80 bg-background" placeholder="Area / Landmark" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Pincode</Label>
                    <Input inputMode="numeric" value={form.pincode} onChange={(e) => update("pincode", e.target.value.replace(/\D/g, ""))} className="h-10 text-xs rounded-xl border-border/80 bg-background" placeholder="6 digit pincode" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">GPS Coordinates *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Latitude" value={form.latitude} onChange={(e) => update("latitude", e.target.value)} className="h-10 text-xs rounded-xl border-border/80 bg-background" />
                      <Input placeholder="Longitude" value={form.longitude} onChange={(e) => update("longitude", e.target.value)} className="h-10 text-xs rounded-xl border-border/80 bg-background" />
                    </div>
                    {fieldError("latitude") || fieldError("longitude")}
                  </div>
                </div>
              </section>

              {/* 4. SPECIFIC DETAILS */}
              {form.clientType && (
                <section id="create-specific-details" className="scroll-mt-4 rounded-2xl border border-border/80 bg-card p-4 space-y-4">
                  <div className="border-b border-border/40 pb-2">
                    <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">
                      4. {isDealer ? "Dealer Specifications" : isSiteVisit ? "Site Visit Specifications" : "Professional Specifications"}
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {isDealer && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">Shop Age (Years) *</Label>
                          <Input type="number" value={form.shopAgeYears} onChange={(e) => update("shopAgeYears", e.target.value)} className="h-10 text-xs rounded-xl border-border/80 bg-background" />
                          {fieldError("shopAgeYears")}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">Stock Capacity (MT)</Label>
                          <Input type="number" value={form.stock} onChange={(e) => update("stock", e.target.value)} className="h-10 text-xs rounded-xl border-border/80 bg-background" />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">Shop Ownership *</Label>
                          <Select value={form.ownershipType} onValueChange={(value) => update("ownershipType", value)}>
                            <SelectTrigger className="h-10 text-xs rounded-xl border-border/80 bg-background"><SelectValue placeholder="Select ownership" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="OWNED" className="text-xs">Owned</SelectItem>
                              <SelectItem value="RENTED" className="text-xs">Rented</SelectItem>
                            </SelectContent>
                          </Select>
                          {fieldError("ownershipType")}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">Dealer Type *</Label>
                          <Select value={form.dealerType} onValueChange={(value) => { update("dealerType", value); if (value !== "ICON") update("dealerSubType", ""); }}>
                            <SelectTrigger className="h-10 text-xs rounded-xl border-border/80 bg-background"><SelectValue placeholder="Select dealer type" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="ICON" className="text-xs">ICON</SelectItem>
                              <SelectItem value="NON_ICON" className="text-xs">NON-ICON</SelectItem>
                            </SelectContent>
                          </Select>
                          {fieldError("dealerType")}
                        </div>

                        {form.dealerType === "ICON" && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-foreground">Dealer Sub-Type *</Label>
                            <Select value={form.dealerSubType} onValueChange={(value) => update("dealerSubType", value)}>
                              <SelectTrigger className="h-10 text-xs rounded-xl border-border/80 bg-background"><SelectValue placeholder="Select subtype" /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="EXCLUSIVE" className="text-xs">Exclusive</SelectItem>
                                <SelectItem value="NON_EXCLUSIVE" className="text-xs">Non-Exclusive</SelectItem>
                              </SelectContent>
                            </Select>
                            {fieldError("dealerSubType")}
                          </div>
                        )}
                      </>
                    )}

                    {isProfessional && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">Date of Birth {isContractor ? "(Optional)" : "*"}</Label>
                          <Input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} className="h-10 text-xs rounded-xl border-border/80 bg-background" />
                          {fieldError("dateOfBirth")}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">Email {isContractor ? "(Optional)" : "*"}</Label>
                          <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="h-10 text-xs rounded-xl border-border/80 bg-background" />
                          {fieldError("email")}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">Years of Experience {isContractor ? "(Optional)" : "*"}</Label>
                          <Input type="number" value={form.yearsOfExperience} onChange={(e) => update("yearsOfExperience", e.target.value)} className="h-10 text-xs rounded-xl border-border/80 bg-background" />
                          {fieldError("yearsOfExperience")}
                        </div>

                        {isContractor && (
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-foreground">Labor Rate (Optional)</Label>
                            <Input type="number" value={form.laborRate} onChange={(e) => update("laborRate", e.target.value)} className="h-10 text-xs rounded-xl border-border/80 bg-background" />
                          </div>
                        )}
                      </>
                    )}

                    {isSiteVisit && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">Engineer</Label>
                          <Select value={form.engineerId} onValueChange={(value) => { const item = engineerOptions.find((entry) => String(entry.id) === value); update("engineerId", value); update("engineerName", item?.name || ""); }}>
                            <SelectTrigger className="h-10 text-xs rounded-xl border-border/80 bg-background"><SelectValue placeholder="Select engineer" /></SelectTrigger>
                            <SelectContent className="rounded-xl">{engineerOptions.map((item) => <SelectItem key={item.id} value={String(item.id)} className="text-xs">{item.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">Contractor</Label>
                          <Select value={form.contractorId} onValueChange={(value) => { const item = contractorOptions.find((entry) => String(entry.id) === value); update("contractorId", value); update("contractorName", item?.name || ""); }}>
                            <SelectTrigger className="h-10 text-xs rounded-xl border-border/80 bg-background"><SelectValue placeholder="Select contractor" /></SelectTrigger>
                            <SelectContent className="rounded-xl">{contractorOptions.map((item) => <SelectItem key={item.id} value={String(item.id)} className="text-xs">{item.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">Project Type</Label>
                          <Select value={form.projectType} onValueChange={(value) => update("projectType", value)}>
                            <SelectTrigger className="h-10 text-xs rounded-xl border-border/80 bg-background"><SelectValue placeholder="Select project type" /></SelectTrigger>
                            <SelectContent className="rounded-xl">{[["HOME","Home"],["APARTMENT","Apartment"],["GOVT_PROJECT","Government"],["COMMERCIAL","Commercial"],["INDUSTRIAL","Industrial"],["OTHERS","Others"]].map(([value,label]) => <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">Project Size (sq ft)</Label>
                          <Input type="number" value={form.projectSize} onChange={(e) => update("projectSize", e.target.value)} className="h-10 text-xs rounded-xl border-border/80 bg-background" />
                        </div>
                      </>
                    )}
                  </div>
                </section>
              )}

              {/* 5. PRODUCTS CHIP SELECTION */}
              {form.clientType && (
                <section id="create-products" className="scroll-mt-4 rounded-2xl border border-border/80 bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">5. Products & Material Mix</h3>
                      <p className="text-[11px] text-muted-foreground">Select relevant product categories for this customer</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {[...productOptions, ...customProducts.map((value) => ({ value, label: value }))].map((option) => {
                      const isChecked = products.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setProducts((current) => isChecked ? current.filter((v) => v !== option.value) : [...new Set([...current, option.value])])}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isChecked
                              ? "bg-foreground text-background shadow-xs scale-[1.02]"
                              : "bg-muted/50 border border-border/70 text-foreground hover:border-foreground/40"
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {!isContractor && (
                    <div className="flex items-center gap-2 pt-2">
                      <Input 
                        placeholder="Add custom product category" 
                        value={customProduct} 
                        onChange={(e) => setCustomProduct(e.target.value)} 
                        className="h-8 text-xs rounded-lg border-border/80 flex-1"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => { 
                          const value = customProduct.trim(); 
                          if (!value) return; 
                          setCustomProducts((current) => [...new Set([...current, value])]); 
                          setProducts((current) => [...new Set([...current, value])]); 
                          setCustomProduct(""); 
                        }}
                        className="h-8 text-xs font-bold rounded-lg border-border/80 hover:bg-foreground hover:text-background"
                      >
                        Add Category
                      </Button>
                    </div>
                  )}
                </section>
              )}

              {/* 6. IMMEDIATE CHECK-IN */}
              {isSiteVisit && (
                <section id="create-check-in" className="scroll-mt-4 rounded-2xl border border-border/80 bg-card p-4 space-y-3">
                  <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">6. Immediate Visit Photo</h3>
                  <p className="text-[11px] text-muted-foreground">Upload a site check-in photo to start visit immediately.</p>
                  
                  <Label 
                    htmlFor="check-in-photo" 
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 p-5 hover:bg-muted/40 transition-all text-xs font-semibold text-foreground"
                  >
                    <Camera className="h-5 w-5 text-foreground" />
                    <span>{checkInImage ? checkInImage.name : "Choose site check-in photo"}</span>
                  </Label>
                  <Input 
                    id="check-in-photo" 
                    className="sr-only" 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    onChange={(e) => { 
                      setCheckInImage(e.target.files?.[0] || null); 
                      setErrors((current) => { const next = {...current}; delete next.checkInImage; return next; }); 
                    }} 
                  />
                  {fieldError("checkInImage")}
                </section>
              )}

              {/* 7. FINISH / SUBMIT SECTION */}
              <section id="create-finish" className="scroll-mt-4 rounded-2xl border border-border/80 bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">Submit Record</h3>
                    <p className="text-[11px] text-muted-foreground">Save customer only, or save and launch a visit</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => submit(false)} 
                      disabled={isSubmitting}
                      className="h-10 text-xs font-bold rounded-xl border-border/80 hover:bg-muted"
                    >
                      <Building2 className="mr-1.5 h-4 w-4" />
                      Create Store Only
                    </Button>

                    <Button 
                      onClick={() => submit(true)} 
                      disabled={isSubmitting}
                      className="h-10 text-xs font-bold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all gap-1.5 shadow-md shadow-foreground/10"
                    >
                      {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                      {isSubmitting ? progress || "Working..." : isSiteVisit ? "Create & Start Visit" : "Create Store & Visit"}
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
