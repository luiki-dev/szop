import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { uuidv7 } from "@szop/shared";
import { EmptyList, ListHeader, TitleField } from "./list-screen.tsx";
import { notSaved } from "../api/client.ts";
import { useCreateList, useLists } from "./use-lists.ts";

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
  // The ID is made here, so a list that holds it can only come from a fetch
  // after the send: no freshness check is needed, unlike the delete's.
  const lists = useLists(create.isError);
  const applied =
    create.isError &&
    lists.data?.some((list) => list.id === create.variables.id) === true;

  // The answer was lost but the list exists: go on as after a success. The
  // mutation has settled here, so the shell's blocker does not hold this.
  useEffect(() => {
    if (applied)
      void navigate(`/lists/${create.variables.id}`, { replace: true });
  }, [applied, create.variables, navigate]);

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
            create
            pending={create.isPending}
            {...(create.error
              ? {
                  error: notSaved(create.error)
                    ? "Not saved. Check your connection and create again."
                    : create.error.message,
                }
              : {})}
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
