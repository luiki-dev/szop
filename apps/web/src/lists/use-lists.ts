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
import { showNotSaved } from "../shell/toasts.tsx";
import { othersWait, refetchIfLast } from "./use-items.ts";

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

// Optimistic, as an item's change (ADR 0073, decision 4): the new name shows
// at once; a failure puts the old name back and shows the error toast. Renames
// run one after the other, and only the last answer writes the list.
export function useRenameList(id: string) {
  const queryClient = useQueryClient();
  const key = ["lists", id];
  const scope = `name-${id}`;
  const setName = (name: string | undefined) => {
    // Stryker disable next-line ConditionalExpression: undefined comes only with no cached list, where setQueryData's updater leaves the cache alone
    if (name === undefined) return;
    queryClient.setQueryData<ListWithItems>(
      key,
      (list) => list && { ...list, name },
    );
  };
  return useMutation({
    mutationFn: (name: string) => renameList(id, name),
    // Stryker disable next-line StringLiteral: any value but "online" behaves as "always", so `""` is the same
    networkMode: "always",
    scope: { id: scope },
    mutationKey: key,
    onMutate: async (name: string) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ListWithItems>(key)?.name;
      setName(name);
      return { previous };
    },
    onSuccess: (list) => {
      if (!othersWait(queryClient, scope)) return remember(queryClient, list);
    },
    // The answer may have been lost on its way: the refetches ask what the
    // server holds (NET-1.5).
    onError: (_, name, context) => {
      // Stryker disable next-line OptionalChaining: onMutate always returns a context; the `?` only guards a failed onMutate
      setName(context?.previous);
      showNotSaved(name);
      void queryClient.invalidateQueries({ queryKey: ["lists"], exact: true });
    },
    onSettled: () => {
      refetchIfLast(queryClient, id);
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
