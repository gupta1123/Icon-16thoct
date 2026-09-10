"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { API, type StoreSummaryPage } from "@/lib/api";
import { validCoordinates, type LocationMarker } from "@/lib/employee-locations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, RefreshCw, RotateCcw } from "lucide-react";

const Map = dynamic(() => import("@/components/employee-location-map"), { ssr: false });

export default function StoreLocationView({ onBack }: { onBack: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [storeName, setStoreName] = useState(searchParams.get("storeName") || "");
  const [district, setDistrict] = useState(searchParams.get("storeDistrict") || "");
  const [query, setQuery] = useState(() => ({
    storeName, district,
    page: Math.max(0, Number(searchParams.get("storePage")) - 1 || 0),
    size: [10, 25, 50].includes(Number(searchParams.get("storePageSize"))) ? Number(searchParams.get("storePageSize")) : 10,
  }));
  const [data, setData] = useState<StoreSummaryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [reset, setReset] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(previous => previous.storeName === storeName && previous.district === district ? previous : ({ ...previous, storeName, district, page: 0 })), 300);
    return () => clearTimeout(timer);
  }, [storeName, district]);
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const values = { storeName: query.storeName, storeDistrict: query.district, storePage: query.page ? String(query.page + 1) : "", storePageSize: query.size === 10 ? "" : String(query.size) };
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value); else params.delete(key);
    }
    if (params.toString() !== searchParams.toString()) router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [query, pathname, router, searchParams]);
  useEffect(() => {
    let active = true;
    // This state tracks a new external request, not derived render data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError(null); setSelected(null);
    API.getStoreSummary(query).then(result => {
      if (active) setData(result);
    }).catch(() => { if (active) { setData(null); setError("Could not load stores. Please try again."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, revision]);
  const markers = useMemo<LocationMarker[]>(() => (data?.content || []).filter(store => validCoordinates(store.latitude, store.longitude)).map(store => ({
    id: `store-${store.storeId}`, storeId: store.storeId, name: store.storeName,
    lat: Number(store.latitude), lng: Number(store.longitude), type: "store",
    subtitle: [store.city, store.district, store.state].filter(Boolean).join(", "),
  })), [data]);
  const selectedMarker = markers.find(marker => marker.storeId === selected);
  const totalPages = data?.totalPages || 0;
  return <section className="space-y-3" aria-label="Store locations">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-sm font-semibold">Store locations</h2><p className="mt-0.5 text-xs text-muted-foreground">Search stores and select a recorded location.</p></div>
      <div className="flex gap-2"><Button size="sm" variant="outline" onClick={onBack}>Employees</Button><Button size="sm" variant="outline" disabled={loading} aria-label="Refresh stores" onClick={() => setRevision(value => value + 1)}><RefreshCw className="h-3.5 w-3.5" /></Button><Button size="sm" variant="outline" onClick={() => { setSelected(null); setReset(value => value + 1); }}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reset view</Button></div>
    </div>
    <div className="flex flex-wrap gap-2">
      <Input aria-label="Filter by store name" placeholder="Search stores…" className="h-9 sm:max-w-xs" value={storeName} onChange={event => setStoreName(event.target.value)} />
      <Input aria-label="Filter by district" placeholder="District…" className="h-9 sm:max-w-[180px]" value={district} onChange={event => setDistrict(event.target.value)} />
      {(storeName || district) && <Button variant="ghost" size="sm" onClick={() => { setStoreName(""); setDistrict(""); }}>Clear filters</Button>}
    </div>
    {error && <div role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}<Button size="sm" variant="ghost" onClick={() => setRevision(value => value + 1)}>Retry</Button></div>}
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="relative isolate h-[55dvh] min-h-[360px] overflow-hidden rounded-lg border lg:h-[calc(100dvh-350px)]">
        <Map markers={loading ? [] : selectedMarker ? [selectedMarker] : markers} center={[20.5937, 78.9629]} zoom={5} highlightedEmployee={null} fitMarkers viewKey={`${query.page}:${selected}:${reset}`} onMarkerClick={marker => setSelected(marker.storeId ?? null)} />
        {(loading || !markers.length) && <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center p-4"><p role="status" className="rounded-lg border bg-card/95 p-3 text-sm">{loading ? "Loading stores…" : "No mapped stores on this page."}</p></div>}
      </div>
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card" aria-label="Store list">
        <div className="flex items-center justify-between border-b px-3 py-2 text-sm"><h3 className="font-medium">Stores</h3><span className="text-xs text-muted-foreground">{data?.totalElements || 0} total</span></div>
        <div className="max-h-[55dvh] flex-1 divide-y overflow-y-auto">
          {!loading && !data?.content?.length && <p className="p-5 text-center text-sm text-muted-foreground">No stores match your filters.</p>}
          {loading ? <p className="p-5 text-sm text-muted-foreground">Loading stores…</p> : data?.content.map(store => {
            const mapped = validCoordinates(store.latitude, store.longitude);
            return <button type="button" key={store.storeId} disabled={!mapped} aria-pressed={selected === store.storeId} className={`block w-full border-l-2 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60 ${selected === store.storeId ? "border-l-primary bg-accent" : "border-l-transparent hover:bg-muted/50"}`} onClick={() => setSelected(store.storeId)}>
              <div className="flex items-center gap-2 text-[13px] font-medium"><Store className="h-4 w-4 shrink-0" />{store.storeName}</div><p className="mt-1 text-xs text-muted-foreground">{[store.city, store.district, store.state].filter(Boolean).join(", ") || "Address not set"}</p>{!mapped && <p className="mt-1 text-xs">No location available</p>}
            </button>;
          })}
        </div>
        <div className="space-y-2 border-t p-3">
          <div className="flex items-center justify-between text-xs"><span>Page {totalPages ? query.page + 1 : 0} of {totalPages}</span><Select value={String(query.size)} onValueChange={value => setQuery(previous => ({ ...previous, size: Number(value), page: 0 }))}><SelectTrigger aria-label="Stores per page" className="h-8 w-20"><SelectValue /></SelectTrigger><SelectContent>{[10, 25, 50].map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex justify-between"><Button size="sm" variant="outline" disabled={loading || query.page === 0} onClick={() => setQuery(previous => ({ ...previous, page: previous.page - 1 }))}>Previous</Button><Button size="sm" variant="outline" disabled={loading || query.page + 1 >= totalPages} onClick={() => setQuery(previous => ({ ...previous, page: previous.page + 1 }))}>Next</Button></div>
        </div>
      </aside>
    </div>
  </section>;
}
