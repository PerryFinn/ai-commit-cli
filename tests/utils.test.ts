import { describe, expect, it } from "vitest";
import { formatErrorMessage, isValidConfigKey, padCenter } from "@/utils";

describe("工具函数", () => {
  it("padCenter 默认应该用空格居中文本", () => {
    expect(padCenter("A", 3)).toBe(" A ");
    expect(padCenter("AB", 5, "-")).toBe("-AB--");
  });

  it("isValidConfigKey 应该验证大写下划线格式的 key", () => {
    expect(isValidConfigKey("MODEL_ID")).toBe(true);
    expect(isValidConfigKey("_A1")).toBe(true);
    expect(isValidConfigKey("model_id")).toBe(false);
    expect(isValidConfigKey("1ABC")).toBe(false);
  });

  it("formatErrorMessage 应该在消息前添加 Error: ", () => {
    expect(formatErrorMessage("oops")).toBe("Error: oops");
  });
});
