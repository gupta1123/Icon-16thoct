"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { API, type ActivityDto, type ActivityLinks } from "@/lib/api";
import { ActivityLinksPicker, useActivityAccess } from "@/components/activity-links";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/detail-ui";

export function ActivityLinkDetails({ activity, refresh }: { activity: ActivityDto; refresh: () => Promise<void> }) {
  const access = useActivityAccess();
  const router = useRouter();
  const [draft, setDraft] = useState<ActivityLinks>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const storeIds = activity.storeIds ?? [];
  const professionalIds = activity.professionalIds ?? activity.professionals?.map(person => person.id) ?? [];
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
        {storeIds.length ? <ul className="space-y-1">{storeIds.map(id => <li key={id}><Link className="underline" href={`/dashboard/customers/${id}`}>Store #{id}</Link></li>)}</ul> : <p className="text-muted-foreground">No linked stores.</p>}
      </div>
      <div>
        <h3 className="font-medium">Professionals</h3>
        {professionalIds.length ? <ul className="space-y-1">{professionalIds.map(id => {
          const person = activity.professionals?.find(person => person.id === id);
          return <li key={id}>{person ? `${person.name} · ${person.role} · ${person.contact}` : `Professional #${id}`}</li>;
        })}</ul> : <p className="text-muted-foreground">No linked professionals.</p>}
      </div>
      {access.edit && <fieldset disabled={busy} className="space-y-3">
        {draft ? <>
          <ActivityLinksPicker value={draft} onChange={setDraft} professionals={activity.professionals} />
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
