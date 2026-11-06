import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkboxSideKey,
  readCheckboxSide,
  storeCheckboxSide,
} from "./checkbox-side.ts";

afterEach(() => {
  vi.restoreAllMocks();
  // With the storage working again, this also forgets a session's choice.
  storeCheckboxSide("right");
});

describe("checkbox side", () => {
  it("APR-2.1: is right when nothing is stored or the value is unknown", () => {
    expect(readCheckboxSide()).toBe("right");
    localStorage.setItem(checkboxSideKey, "up");
    expect(readCheckboxSide()).toBe("right");
  });

  it("APR-2.3: stores left and forgets it for right", () => {
    storeCheckboxSide("left");
    expect(localStorage.getItem("szop-checkbox-side")).toBe("left");
    expect(readCheckboxSide()).toBe("left");

    storeCheckboxSide("right");
    expect(localStorage.getItem(checkboxSideKey)).toBeNull();
  });

  it("APR-2.3: holds for the visit when the storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readCheckboxSide()).toBe("right");
    storeCheckboxSide("left");

    expect(readCheckboxSide()).toBe("left");
  });
});
