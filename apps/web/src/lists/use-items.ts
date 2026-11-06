import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { ListItem, ListWithItems, UpdateItem } from "@szop/shared";
import {
  createItem,
  deleteItem,
  updateItem,
  updateList,
} from "../api/client.ts";
import { showNotSaved, showSortNotSaved } from "../shell/toasts.tsx";

// Every change shows on the screen at once (onMutate), is sent in the order
// made (one mutation scope per item, so TanStack Query runs an item's changes
// one after the other), and goes back, with a toast, when the server refuses
// it. Only the changed item goes back: another item's change in flight keeps
// its state. The cache holds the list with its items (ADR 0071).
const listKey = (listId: string) => ["lists", listId];

type Items = (items: ListItem[]) => ListItem[];

function writeItems(queryClient: QueryClient, listId: string, change: Items) {
  queryClient.setQueryData<ListWithItems>(
    listKey(listId),
    (list) => list && { ...list, items: change(list.items) },
  );
}

// The failed change asks the server what it holds, but only when it is the
// last change of the list in flight: a refetch earlier would answer without
// the changes still on their way and wipe their optimistic state.
function refetchIfLast(queryClient: QueryClient, listId: string) {
  if (queryClient.isMutating({ mutationKey: listKey(listId) }) === 1)
    void queryClient.invalidateQueries({ queryKey: listKey(listId) });
}

// True when more changes of this scope wait behind the one that just ended:
// its answer must not put an older state back over theirs.
function othersWait(queryClient: QueryClient, scope: string) {
  return (
    queryClient.isMutating({
      predicate: (mutation) => mutation.options.scope?.id === scope,
    }) > 1
  );
}

// What an item's change is: how the list shows it, and what its name is in
// the failure toast.
interface Change<Variables, Answer> {
  send: (variables: Variables) => Promise<Answer>;
  apply: (items: ListItem[], variables: Variables) => ListItem[];
  name: (variables: Variables, previous: ListItem | undefined) => string;
}

function useItemMutation<Variables, Answer extends ListItem | undefined>(
  listId: string,
  itemId: string,
  change: Change<Variables, Answer>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change.send,
    // Stryker disable next-line StringLiteral: any value but "online" behaves as "always", so `""` is the same
    networkMode: "always",
    scope: { id: itemId },
    mutationKey: listKey(listId),
    onMutate: async (variables: Variables) => {
      await queryClient.cancelQueries({ queryKey: listKey(listId) });
      const items =
        queryClient.getQueryData<ListWithItems>(listKey(listId))?.items ?? [];
      const previous = items.find((item) => item.id === itemId);
      writeItems(queryClient, listId, (current) =>
        change.apply(current, variables),
      );
      return { previous };
    },
    onSuccess: (answer) => {
      if (!answer || othersWait(queryClient, itemId)) return;
      writeItems(queryClient, listId, (items) =>
        items.map((item) => (item.id === answer.id ? answer : item)),
      );
    },
    onError: (_, variables, context) => {
      const previous = context?.previous;
      writeItems(queryClient, listId, (items) => {
        const rest = items.filter((item) => item.id !== itemId);
        if (!previous) return rest;
        // In place when still there; else by ID, which is the list's order.
        if (rest.length < items.length)
          return items.map((item) => (item.id === itemId ? previous : item));
        const at = rest.findIndex((item) => item.id > itemId);
        return rest.toSpliced(at < 0 ? rest.length : at, 0, previous);
      });
      showNotSaved(change.name(variables, previous));
      // The answer may have been lost on its way: ask what the server holds.
      refetchIfLast(queryClient, listId);
    },
  });
}

function newItem(id: string, name: string): ListItem {
  return {
    id,
    name,
    quantity: null,
    unitId: null,
    price: null,
    categoryId: null,
    note: null,
    checkedAt: null,
  };
}

export function useAddItem(listId: string, itemId: string) {
  return useItemMutation<string, ListItem>(listId, itemId, {
    send: (name) => createItem(listId, { id: itemId, name }),
    apply: (items, name) => [...items, newItem(itemId, name)],
    name: (name) => name,
  });
}

export function useUpdateItem(listId: string, itemId: string) {
  return useItemMutation<UpdateItem, ListItem>(listId, itemId, {
    send: (changes) => updateItem(listId, itemId, changes),
    apply: (items, { checked, ...fields }) =>
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...fields,
              // The browser's now stands in until the answer brings the server's.
              ...(checked === undefined
                ? {}
                : { checkedAt: checked ? new Date().toISOString() : null }),
            }
          : item,
      ),
    name: (changes, previous) => changes.name ?? previous?.name ?? "",
  });
}

export function useRemoveItem(listId: string, itemId: string) {
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- `mutate()` takes no argument only when the variables are void
  return useItemMutation<void, undefined>(listId, itemId, {
    send: async () => {
      await deleteItem(listId, itemId);
      return undefined;
    },
    apply: (items) => items.filter((item) => item.id !== itemId),
    name: (_, previous) => previous?.name ?? "",
  });
}

// Undo: a create with every field.
export function useRestoreItem(listId: string, itemId: string) {
  return useItemMutation<ListItem, ListItem>(listId, itemId, {
    send: (item) => createItem(listId, item),
    apply: (items, item) => [...items, item],
    name: (item) => item.name,
  });
}

export function useSortByCategory(listId: string) {
  const queryClient = useQueryClient();
  const scope = `list-${listId}`;
  const setSort = (value: boolean | undefined) => {
    if (value === undefined) return;
    queryClient.setQueryData<ListWithItems>(
      listKey(listId),
      (list) => list && { ...list, sortByCategory: value },
    );
  };
  return useMutation({
    mutationFn: (value: boolean) =>
      updateList(listId, { sortByCategory: value }),
    // Stryker disable next-line StringLiteral: any value but "online" behaves as "always", so `""` is the same
    networkMode: "always",
    scope: { id: scope },
    mutationKey: listKey(listId),
    onMutate: async (value: boolean) => {
      await queryClient.cancelQueries({ queryKey: listKey(listId) });
      const previous = queryClient.getQueryData<ListWithItems>(
        listKey(listId),
      )?.sortByCategory;
      setSort(value);
      return { previous };
    },
    onSuccess: (list) => {
      if (!othersWait(queryClient, scope)) setSort(list.sortByCategory);
    },
    onError: (_, __, context) => {
      setSort(context?.previous);
      showSortNotSaved();
      refetchIfLast(queryClient, listId);
    },
  });
}
