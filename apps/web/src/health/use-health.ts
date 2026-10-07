import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../api/client.ts";

// No retries: this page exists to show a failure, and TanStack Query's default
// of three retries would hide it behind "Checking the API…" for about seven
// seconds (ADR 0021, decision 5).
export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: getHealth, retry: false });
}
