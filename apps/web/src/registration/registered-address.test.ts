import { beforeEach, describe, expect, it } from "vitest";
import {
  forgetRegisteredAddress,
  registeredAddress,
  saveRegisteredAddress,
} from "./registered-address.ts";

beforeEach(() => {
  localStorage.clear();
});

describe("the registered address", () => {
  it("is kept, read and forgotten", () => {
    expect(registeredAddress()).toBeNull();
    saveRegisteredAddress("ania@example.com");
    expect(registeredAddress()).toBe("ania@example.com");
    forgetRegisteredAddress();
    expect(registeredAddress()).toBeNull();
  });
});
