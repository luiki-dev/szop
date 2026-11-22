import { useQuery } from "@tanstack/react-query";
import { getSession } from "../api/auth.ts";

// The session's user (null for a guest or while it loads, which `loading` tells). The key is the one
// the registration page reads, so the two share one answer.
export function useSession() {
  const { data, isPending } = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    retry: false,
  });
  return {
    user: data?.user && !data.user.isAnonymous ? data.user : null,
    loading: isPending,
  };
}
