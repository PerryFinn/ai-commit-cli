import { describe, expect, it } from "vitest";
import { add } from "../src/utils";

describe("add", () => {
  it("should return the sum of two numbers", () => {
    expect(add(1, 2)).toBe(3);
    expect(add(-1, -1)).toBe(-2);
    expect(add(0, 0)).toBe(0);
  });

  it("should return the sum of two floating point numbers", () => {
    expect(add(1.1, 2.2)).toBeCloseTo(3.3);
    expect(add(-1.1, -1.1)).toBeCloseTo(-2.2);
  });

  it("should return the sum of large numbers", () => {
    expect(add(1e10, 1e10)).toBe(2e10);
    expect(add(-1e10, -1e10)).toBe(-2e10);
  });

  it("should return NaN when one of the inputs is NaN", () => {
    expect(add(Number.NaN, 1)).toBeNaN();
    expect(add(1, Number.NaN)).toBeNaN();
  });

  it("should return Infinity when one of the inputs is Infinity", () => {
    expect(add(Number.POSITIVE_INFINITY, 1)).toBe(Number.POSITIVE_INFINITY);
    expect(add(1, Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });

  it("should return -Infinity when one of the inputs is -Infinity", () => {
    expect(add(Number.NEGATIVE_INFINITY, 1)).toBe(Number.NEGATIVE_INFINITY);
    expect(add(1, Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY);
  });

  it("should return 0 when adding 0 and -0", () => {
    expect(add(0, -0)).toBe(0);
    expect(add(-0, 0)).toBe(0);
  });

  it("should return -0 when adding -0 and -0", () => {
    expect(add(-0, -0)).toBe(-0);
  });
});
