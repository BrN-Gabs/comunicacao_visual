"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRouteTransition } from "@/components/transition/route-transition-provider";

export function useAuthGuard() {
  const router = useRouter();
  const { startRouteTransition } = useRouteTransition();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      startRouteTransition({
        label: "Redirecionando para o login",
        minDuration: 700,
      });
      router.push("/login");
      return;
    }

    setIsReady(true);
  }, [router, startRouteTransition]);

  return { isReady };
}
