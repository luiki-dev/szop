import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { List, ListWithItems } from "@szop/shared";
import {
  ApiRequestError,
  createList,
  deleteList,
  deleteLists,
  getList,
  getLists,
  renameList,
} from "../api/client.ts";

// No retries: the error card's "Try again" is the retry. A failed create or
// delete passes its isError as `enabled`: turning the observer on refetches
// the stale lists, to see whether the change was applied after all.
export function useLists(enabled = true) {
  return useQuery({
    queryKey: ["lists"],
    queryFn: getLists,
    enabled,
    retry: false,
  });
}

export function useList(id: string, enabled = true) {
  return useQuery({
    queryKey: ["lists", id],
    queryFn: () => getList(id),
    enabled,
    retry: false,
  });
}

// The list is known now: keep it for its screen (its items stay; a new list
// has none), refresh the lists page.
function remember(queryClient: QueryClient, list: List) {
  queryClient.setQueryData<ListWithItems>(["lists", list.id], (old) => ({
    items: [],
    ...old,
    ...list,
  }));
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
    // The answer may have been lost on its way: ask what the server holds, in
    // the background (awaiting it would hold the mutation in "pending").
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["lists", id] });
      void queryClient.invalidateQueries({ queryKey: ["lists"], exact: true });
    },
  });
}

// A list that is already gone (404) is what the user asked for.
async function remove(ids: string[]) {
  if (ids.length > 1) return deleteLists(ids);
  try {
    // Stryker disable next-line StringLiteral: ids has at least one entry
    await deleteList(ids[0] ?? "");
  } catch (error) {
    if (!(error instanceof ApiRequestError && error.status === 404))
      throw error;
  }
}

export function useDeleteLists() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: remove,
    // Stryker disable next-line StringLiteral: any value but "online" behaves as "always", so `""` is the same
    networkMode: "always",
    onSuccess: (_, ids) => {
      // Inactive only: the list's screen still observes its list until the
      // navigation lands (it removes its own entry then, see ListPage).
      for (const id of ids)
        queryClient.removeQueries({
          queryKey: ["lists", id],
          type: "inactive",
        });
      // The deleted lists leave the cache at once, so they do not flash back;
      // the refetch runs in the background (awaiting it would keep the dialog
      // on "Deleting…").
      queryClient.setQueryData<List[]>(["lists"], (lists) =>
        lists?.filter((list) => !ids.includes(list.id)),
      );
      void queryClient.invalidateQueries({ queryKey: ["lists"], exact: true });
    },
  });
}
