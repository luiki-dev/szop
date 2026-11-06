import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { threeLists } from "../test/lists.ts";
import { server } from "../test/server.ts";
import { DeleteListsDialog } from "./delete-lists-dialog.tsx";

const [party] = threeLists;
const one = [{ id: party?.id ?? "", name: "Weekly" }];

function Harness({
  lists,
  onDeleted,
}: {
  lists: typeof one;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
      >
        Reopen
      </button>
      <DeleteListsDialog
        lists={lists}
        open={open}
        onOpenChange={setOpen}
        onDeleted={onDeleted}
      />
    </>
  );
}

function setup(lists = one) {
  const onDeleted = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness lists={lists} onDeleted={onDeleted} />
    </QueryClientProvider>,
  );
  server.use(
    http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
    // What the server holds when a failed delete makes the dialog ask.
    http.get("/api/lists", () => HttpResponse.json({ lists: threeLists })),
  );
  return { onDeleted };
}

const deleteButton = () => screen.getByRole("button", { name: "Delete" });
const deletingButton = () => screen.getByRole("button", { name: "Deleting…" });

describe("DeleteListsDialog", () => {
  it("APP-3.3: names the list, or the count, and focuses Cancel", async () => {
    setup();
    expect(
      await screen.findByRole("alertdialog", { name: 'Delete list "Weekly"?' }),
    ).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });
  });

  it("APP-3.3: names the count for several lists", async () => {
    setup(threeLists.map(({ id, name }) => ({ id, name })));
    expect(
      await screen.findByRole("alertdialog", { name: "Delete 3 lists?" }),
    ).toBeInTheDocument();
  });

  it("APP-3.3: Esc closes it without a request", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole("alertdialog");

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  it("APP-3.3: Cancel closes it without a request", async () => {
    const user = userEvent.setup();
    const { onDeleted } = setup();
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("NET-1.8: while lists are deleted, Delete reads Deleting…", async () => {
    const user = userEvent.setup();
    let count = 0;
    server.use(
      http.delete(`/api/lists/${one[0]?.id ?? ""}`, async () => {
        count += 1;
        await new Promise(() => undefined);
      }),
    );
    setup();
    await screen.findByRole("alertdialog");

    await user.click(deleteButton());
    await waitFor(() => {
      expect(deletingButton()).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    await user.click(deletingButton());

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(count).toBe(1);
  });

  it("NET-1.7: a failed delete keeps the dialog and its message, and Delete sends again", async () => {
    const user = userEvent.setup();
    let status = 500;
    server.use(
      http.delete(`/api/lists/${one[0]?.id ?? ""}`, () =>
        status === 500
          ? new HttpResponse(null, { status })
          : new HttpResponse(null, { status: 204 }),
      ),
    );
    const { onDeleted } = setup();
    await screen.findByRole("alertdialog");

    await user.click(deleteButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't delete the list. Check your connection and try again.",
    );
    expect(deleteButton()).toBeEnabled();

    status = 204;
    await user.click(deleteButton());
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("NET-1.7: a refused delete does not tell the person to check the connection", async () => {
    const user = userEvent.setup();
    server.use(
      http.delete(`/api/lists/${one[0]?.id ?? ""}`, () =>
        HttpResponse.json(
          { error: { code: "forbidden", message: "Not your list" } },
          { status: 403 },
        ),
      ),
    );
    setup();
    await screen.findByRole("alertdialog");

    await user.click(deleteButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Couldn't delete the list.");
  });

  it("APP-3.3: closing after a failed delete forgets the message", async () => {
    const user = userEvent.setup();
    server.use(
      http.delete(
        `/api/lists/${one[0]?.id ?? ""}`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    setup();
    await screen.findByRole("alertdialog");
    await user.click(deleteButton());
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Reopen" }));

    await screen.findByRole("alertdialog");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("APP-3.3: says lists in the plural, and sends one request with every ID", async () => {
    const user = userEvent.setup();
    let body: unknown;
    let fail = true;
    server.use(
      http.post("/api/lists/delete", async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: fail ? 500 : 204 });
      }),
    );
    const lists = threeLists.map(({ id, name }) => ({ id, name }));
    const { onDeleted } = setup(lists);
    await screen.findByRole("alertdialog");

    await user.click(deleteButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't delete the lists. Check your connection and try again.",
    );
    fail = false;
    await user.click(deleteButton());
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(body).toEqual({ ids: lists.map((list) => list.id) });
  });

  it("NET-1.5: a delete whose answer was lost closes the dialog", async () => {
    const user = userEvent.setup();
    server.use(
      http.delete(`/api/lists/${one[0]?.id ?? ""}`, () => HttpResponse.error()),
    );
    const { onDeleted } = setup();
    server.use(http.get("/api/lists", () => HttpResponse.json({ lists: [] })));
    await screen.findByRole("alertdialog");

    await user.click(deleteButton());

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("NET-1.5: a failed delete whose cached lists already lack the ID keeps the dialog while the refetch runs", async () => {
    const user = userEvent.setup();
    const client = new QueryClient();
    client.setQueryData(["lists"], []);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
      http.delete(`/api/lists/${one[0]?.id ?? ""}`, () => HttpResponse.error()),
      http.get("/api/lists", async () => {
        await gate;
        return HttpResponse.json({ lists: threeLists });
      }),
    );
    const onDeleted = vi.fn();
    render(
      <QueryClientProvider client={client}>
        <Harness lists={one} onDeleted={onDeleted} />
      </QueryClientProvider>,
    );
    await screen.findByRole("alertdialog");

    await user.click(deleteButton());
    await screen.findByRole("alert");

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    release();
    await waitFor(() => {
      expect(client.getQueryState(["lists"])?.fetchStatus).toBe("idle");
    });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("APP-3.3: a 404 counts as deleted", async () => {
    const user = userEvent.setup();
    server.use(
      http.delete(
        `/api/lists/${one[0]?.id ?? ""}`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    const { onDeleted } = setup();
    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
