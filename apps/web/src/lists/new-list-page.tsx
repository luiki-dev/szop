import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { uuidv7 } from "@szop/shared";
import { EmptyList, ListHeader, TitleField } from "./list-screen.tsx";
import { useCreateList } from "./use-lists.ts";

function setTitle() {
  document.title = "New list · Szop";
}

// /lists/new: the list's screen with an empty, focused name field. Enter
// creates the list; Esc or leaving empty-handed stores nothing.
export function NewListPage() {
  const navigate = useNavigate();
  const create = useCreateList();
  // Made on the first Enter and kept, so a retry after a failure sends the
  // same ID and cannot make a second list.
  const id = useRef<string>(undefined);

  // Stryker disable next-line ArrayDeclaration: the dependency list of a run-once effect; a constant item behaves the same
  useEffect(setTitle, []);

  return (
    <>
      <h1 className="sr-only">New list</h1>
      <ListHeader
        field={
          <TitleField
            initial=""
            autoFocus
            pending={create.isPending}
            {...(create.error ? { error: create.error.message } : {})}
            onSave={(name) => {
              id.current ??= uuidv7();
              create.mutate(
                { id: id.current, name },
                {
                  onSuccess: (list) => {
                    void navigate(`/lists/${list.id}`, { replace: true });
                  },
                },
              );
            }}
            onCancel={() => {
              void navigate("/");
            }}
          />
        }
      />
      <EmptyList />
    </>
  );
}
