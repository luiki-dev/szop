import { useQuery } from "@tanstack/react-query";
import { getCatalog } from "../api/client.ts";

// The catalog changes only with a deploy, so it is kept for the session. No
// retries: the error card's "Try again" is the retry.
export function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    queryFn: getCatalog,
    staleTime: Infinity,
    retry: false,
  });
}
