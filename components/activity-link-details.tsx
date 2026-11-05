"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API, apiService, type ActivityDto, type ActivityLinks, type StoreDto } from "@/lib/api";
import { ActivityLinksPicker, useActivityAccess } from "@/components/activity-links";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/detail-ui";

export function ActivityLinkDetails({ activity, refresh }: { activity: ActivityDto; refresh: () => Promise<void> }) {
  const access = useActivityAccess();
  const router = useRouter();
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [storeErrors, setStoreErrors] = useState<number[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storeRetry, setStoreRetry] = useState(0);
  const [draft, setDraft] = useState<ActivityLinks>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const storeIds = activity.storeIds ?? [];
  const professionalIds = activity.professionalIds ?? activity.professionals?.map(person => person.id) ?? [];
  const storeIdsKey = JSON.stringify(storeIds);
  useEffect(() => {
    let active = true;
    const ids = JSON.parse(storeIdsKey) as number[];
    setStores([]);
    setStoreErrors([]);
    setStoresLoading(true);
    Promise.allSettled(ids.map(id => apiService.getStoreById(id))).then(results => {
      if (!active) return;
      const loaded: StoreDto[] = [];
      const failed: number[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value?.storeName?.trim()) {
          loaded.push({ ...result.value, storeId: ids[index] });
        } else {
          failed.push(ids[index]);
        }
      });
      setStores(loaded);
      setStoreErrors(failed);
      setStoresLoading(false);
    });
    return () => { active = false; };
  }, [storeIdsKey, storeRetry]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await action(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not update activity."); }
    finally { setBusy(false); }
  };

  return <Section title="Linked stores and professionals" bodyClassName="space-y-4 p-4">
      <div>
        <h3 className="font-medium">Stores</h3>
        {storeIds.length ? <ul className="space-y-1">{storeIds.map(id => <li key={id}><Link className="underline" href={`/dashboard/customers/${id}`}>{stores.find(store => store.storeId === id)?.storeName ?? (storesLoading ? "Loading store…" : `Store #${id}`)}</Link></li>)}</ul> : <p className="text-muted-foreground">No linked stores.</p>}
      </div>
      {storeErrors.length > 0 && <p role="alert" className="text-sm text-destructive">
        Could not load {storeErrors.length === 1 ? "a store name" : "some store names"}. <button type="button" className="underline" onClick={() => setStoreRetry(value => value + 1)}>Retry</button>
      </p>}
      <div>
        <h3 className="font-medium">Professionals</h3>
        {professionalIds.length ? <ul className="space-y-1">{professionalIds.map(id => {
          const person = activity.professionals?.find(person => person.id === id);
          return <li key={id}>{person ? `${person.name} · ${person.role} · ${person.contact}` : `Professional #${id}`}</li>;
        })}</ul> : <p className="text-muted-foreground">No linked professionals.</p>}
      </div>
      {access.edit && <fieldset disabled={busy} className="space-y-3">
        {draft ? <>
          <ActivityLinksPicker value={draft} onChange={setDraft} professionals={activity.professionals} linkedStores={stores} />
          <div className="flex gap-2">
            <Button type="button" onClick={() => void run(async () => {
              await API.editActivityLinks(activity.id, draft);
              setDraft(undefined);
              await refresh();
            })}>Save links</Button>
            <Button type="button" variant="outline" onClick={() => setDraft(undefined)}>Cancel</Button>
          </div>
        </> : confirmDelete ? <>
          <p>Delete this activity permanently?</p>
          <div className="flex gap-2">
            <Button type="button" variant="destructive" onClick={() => void run(async () => {
              await API.deleteActivity(activity.id);
              router.replace("/dashboard/activities");
            })}>Confirm delete</Button>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        </> : <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setDraft({ storeIds, professionalIds })}>Edit links</Button>
          <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>Delete activity</Button>
        </div>}
      </fieldset>}
      {busy && <p role="status">Working…</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </Section>;
}
