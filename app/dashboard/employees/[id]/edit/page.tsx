"use client";

import { useParams } from "next/navigation";
import EmployeeEditPage from '@/components/employee-edit-page';
import { UnsavedChangesProvider } from '@/components/unsaved-changes-provider';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function EditEmployeePage() {
  const params = useParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const employeeId = Number(rawId);

  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Invalid employee id.
        <div><Button variant="link" asChild><Link href="/dashboard/employees">Back to Employees</Link></Button></div>
      </div>
    );
  }

  return <UnsavedChangesProvider><EmployeeEditPage employeeId={employeeId} /></UnsavedChangesProvider>;
}
