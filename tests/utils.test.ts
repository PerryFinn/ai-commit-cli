import { describe, expect, it } from "vitest";
import { formatErrorMessage, isValidConfigKey, padCenter } from "../src/utils";

describe("utils", () => {
  it("padCenter should center text with spaces by default", () => {
    expect(padCenter("A", 3)).toBe(" A ");
    expect(padCenter("AB", 5, "-")).toBe("-AB--");
  });

  it("isValidConfigKey should validate uppercase underscore keys", () => {
    expect(isValidConfigKey("MODEL_ID")).toBe(true);
    expect(isValidConfigKey("_A1")).toBe(true);
    expect(isValidConfigKey("model_id")).toBe(false);
    expect(isValidConfigKey("1ABC")).toBe(false);
  });

  it("formatErrorMessage should prepend Error: ", () => {
    expect(formatErrorMessage("oops")).toBe("Error: oops");
  });
});
