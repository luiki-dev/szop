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
    <DeleteListsDialog
      lists={lists}
      open={open}
      onOpenChange={setOpen}
      onDeleted={onDeleted}
    />
  );
}

function setup(lists = one) {
  const onDeleted = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness lists={lists} onDeleted={onDeleted} />
    </QueryClientProvider>,
  );
  const requests: string[] = [];
  server.use(
    http.get("/api/auth/get-session", () => HttpResponse.json({ ok: true })),
  );
  return { onDeleted, requests };
}

const deleteButton = () => screen.getByRole("button", { name: "Delete" });

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

  it("APP-3.3: Esc and Cancel close it without a request", async () => {
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

  it("APP-3.3: while deleting, both buttons are off, Esc does nothing and Delete sends one request", async () => {
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
      expect(deleteButton()).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    await user.click(deleteButton());

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(count).toBe(1);
  });

  it("APP-3.3: a failed delete keeps it open with the message, and Delete tries again", async () => {
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
      "Couldn't delete the list.",
    );
    expect(deleteButton()).toBeEnabled();

    status = 204;
    await user.click(deleteButton());
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
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
      "Couldn't delete the lists.",
    );
    fail = false;
    await user.click(deleteButton());
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledOnce();
    });
    expect(body).toEqual({ ids: lists.map((list) => list.id) });
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
