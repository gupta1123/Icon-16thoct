"use client";

import { useState } from "react";
import { API, type ActivityLinks, type ActivityProfessional, type StoreDto } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { extractAuthorityRoles, hasAnyRole, normalizeRoleValue } from "@/lib/role-utils";

export function useActivityAccess() {
  const { userRole, currentUser, userData, isLoading } = useAuth();
  const roles = extractAuthorityRoles(currentUser?.authorities);
  const has = (...allowed: string[]) => hasAnyRole(normalizeRoleValue(userRole), roles, allowed);
  return {
    isLoading,
    employeeId: userData?.employeeId,
    create: has("FIELD_OFFICER", "REGIONAL_MANAGER", "COORDINATOR", "AVP"),
    edit: has("FIELD_OFFICER", "REGIONAL_MANAGER", "ADMIN"),
  };
}

export function ActivityLinksPicker({ value, onChange, professionals = [] }: {
  value: ActivityLinks;
  onChange: (value: ActivityLinks) => void;
  professionals?: ActivityProfessional[];
}) {
  const [storeQuery, setStoreQuery] = useState("");
  const [professionalQuery, setProfessionalQuery] = useState("");
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [results, setResults] = useState<ActivityProfessional[]>([]);
  const [storeContext, setStoreContext] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const context = value.storeIds.includes(storeContext ?? -1) ? storeContext : undefined;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice("");
    try { await action(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Request failed."); }
    finally { setBusy(false); }
  };
  const toggle = (field: keyof ActivityLinks, id: number) => {
    onChange({ ...value, [field]: value[field].includes(id) ? value[field].filter(item => item !== id) : [...value[field], id] });
  };
  return (
    <div className="space-y-4">
      <fieldset disabled={busy} className="space-y-2">
        <legend className="font-medium">Stores</legend>
        <div className="flex gap-2">
          <Input aria-label="Store name" value={storeQuery} onChange={e => setStoreQuery(e.target.value)} placeholder="Store name" />
          <Button type="button" variant="outline" disabled={!storeQuery.trim()} onClick={() => void run(async () => {
            const page = await API.getStoresFilteredPaginated({ storeName: storeQuery.trim(), page: 0, size: 20 });
            setStores(page.content);
            if (!page.content.length) setNotice("No matching stores.");
          })}>Search stores</Button>
        </div>
        {value.storeIds.map(id => <Button key={id} type="button" variant="secondary" className="mr-2" onClick={() => toggle("storeIds", id)}>Remove {stores.find(store => store.storeId === id)?.storeName ?? `store #${id}`}</Button>)}
        <div className="max-h-44 space-y-1 overflow-auto">
          {stores.filter(store => !value.storeIds.includes(store.storeId)).map(store => (
            <Button key={store.storeId} type="button" variant="ghost" onClick={() => toggle("storeIds", store.storeId)}>Add {store.storeName} (#{store.storeId})</Button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={busy} className="space-y-2">
        <legend className="font-medium">Professionals</legend>
        <select aria-label="Store context for professionals" className="rounded border bg-background p-2" value={context ?? ""} onChange={e => { setStoreContext(Number(e.target.value) || undefined); setResults([]); }}>
          <option value="">All stores</option>
          {value.storeIds.map(id => <option key={id} value={id}>{stores.find(store => store.storeId === id)?.storeName ?? `Store #${id}`}</option>)}
        </select>
        {context !== undefined && <Button className="ml-2" type="button" variant="outline" onClick={() => void run(async () => {
          const rows = await API.getStoreProfessionals(context);
          setResults(rows.map(row => ({ ...row, connectedToStore: true })));
          if (!rows.length) setNotice("This store has no linked professionals.");
        })}>Show store professionals</Button>}
        <div className="flex gap-2">
          <Input aria-label="Professional name or phone" value={professionalQuery} onChange={e => setProfessionalQuery(e.target.value)} placeholder="Name or phone" />
          <Button type="button" variant="outline" disabled={!professionalQuery.trim()} onClick={() => void run(async () => {
            const rows = await API.searchActivityProfessionals(professionalQuery.trim(), context);
            setResults(rows);
            if (!rows.length) setNotice("No matching professionals.");
          })}>Search professionals</Button>
        </div>
        {value.professionalIds.map(id => <Button key={id} type="button" variant="secondary" className="mr-2" onClick={() => toggle("professionalIds", id)}>Remove {[...results, ...professionals].find(person => person.id === id)?.name ?? `professional #${id}`}</Button>)}
        <ul className="max-h-52 space-y-2 overflow-auto">
          {results.map(person => <li key={person.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span>{person.name} · {person.role} · {person.contact}</span>
            {!value.professionalIds.includes(person.id) && <Button type="button" variant="outline" size="sm" onClick={() => toggle("professionalIds", person.id)}>Add to activity</Button>}
            {context !== undefined && (person.connectedToStore ? <span>Linked to store</span> : <Button type="button" variant="outline" size="sm" onClick={() => void run(async () => {
              await API.linkProfessionalToStore(person.id, context);
              setResults(rows => rows.map(row => row.id === person.id ? { ...row, connectedToStore: true } : row));
              setNotice("Professional linked to store.");
            })}>Link to store</Button>)}
          </li>)}
        </ul>
      </fieldset>
      <p role="status" className="text-sm text-muted-foreground">{busy ? "Loading…" : notice}</p>
    </div>
  );
}
