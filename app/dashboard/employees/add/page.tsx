"use client";

import EmployeeCreatePage from '@/components/employee-create-page';
import { UnsavedChangesProvider } from '@/components/unsaved-changes-provider';

export default function AddEmployeePage() {
  return <UnsavedChangesProvider><EmployeeCreatePage /></UnsavedChangesProvider>;
}
