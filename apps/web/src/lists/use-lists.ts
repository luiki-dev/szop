import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { List } from "@szop/shared";
import { createList, getList, getLists, renameList } from "../api/client.ts";

// No retries: the error card's "Try again" is the retry.
export function useLists() {
  return useQuery({ queryKey: ["lists"], queryFn: getLists, retry: false });
}

export function useList(id: string) {
  return useQuery({
    queryKey: ["lists", id],
    queryFn: () => getList(id),
    retry: false,
  });
}

// The list is known now: keep it for its screen, refresh the lists page.
function remember(queryClient: QueryClient, list: List) {
  queryClient.setQueryData(["lists", list.id], list);
  return queryClient.invalidateQueries({ queryKey: ["lists"], exact: true });
}

// networkMode "always": the write is tried even when the browser thinks it is
// offline, so the failure comes back as an error to show, not a silent pause.
export function useCreateList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createList,
    // Stryker disable next-line StringLiteral: any value but "online" behaves as "always", so `""` is the same
    networkMode: "always",
    onSuccess: (list) => remember(queryClient, list),
  });
}

export function useRenameList(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => renameList(id, name),
    // Stryker disable next-line StringLiteral: any value but "online" behaves as "always", so `""` is the same
    networkMode: "always",
    onSuccess: (list) => remember(queryClient, list),
  });
}
