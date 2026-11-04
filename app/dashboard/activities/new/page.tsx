"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { API, type ActivityLinks } from "@/lib/api";
import { ActivityLinksPicker, useActivityAccess } from "@/components/activity-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function NewActivityPage() {
  const access = useActivityAccess();
  const router = useRouter();
  const [links, setLinks] = useState<ActivityLinks>({ storeIds: [], professionalIds: [] });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (access.isLoading) return <p>Loading…</p>;
  if (!access.create || !access.employeeId) return <p>Activity creation requires an eligible employee account.</p>;

  return <form className="mx-auto max-w-3xl space-y-4 rounded-lg border bg-card p-5" onSubmit={async event => {
    event.preventDefault();
    if (saving || !title.trim() || !access.employeeId) return;
    setSaving(true);
    setError("");
    try {
      const id = await API.createActivity({ title: title.trim(), description: description.trim(), employeeId: access.employeeId, ...links });
      router.replace(id ? `/dashboard/activities/${id}` : "/dashboard/activities");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create activity.");
      setSaving(false);
    }
  }}>
    <fieldset disabled={saving} className="space-y-4">
      <label className="block">Title<Input required value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label className="block">Description<Textarea value={description} onChange={e => setDescription(e.target.value)} /></label>
      <ActivityLinksPicker value={links} onChange={setLinks} />
      <div className="flex gap-2">
        <Button asChild variant="outline"><Link href="/dashboard/activities">Cancel</Link></Button>
        <Button type="submit" disabled={saving || !title.trim()}>{saving ? "Creating…" : "Create activity"}</Button>
      </div>
    </fieldset>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </form>;
}
