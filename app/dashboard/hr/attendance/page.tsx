"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HRAttendance() {
  const router = useRouter();
  
  // Redirect to main attendance page
  useEffect(() => {
    router.replace('/dashboard/attendance');
  }, [router]);
  
  return null;
}
