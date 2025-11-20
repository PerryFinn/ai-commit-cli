import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Cmd from "@/cli/commands/config";
import { ConfigManager } from "@/config/config-manager";

vi.mock("@/config/config-manager");

describe("CLI config 命令", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("set 应该解析 key=value 并使用字符串调用 manager.set", async () => {
    const setMock = vi.fn();
    const getMock = vi.fn((key: string) => {
      if (key === "AIGCM_MODEL_ID") return { value: "gpt-4o", source: "config" };
      if (key === "AIGCM_ONE_LINE_COMMIT") return { value: true, source: "config" };
      if (key === "AIGCM_MAX_TOKEN_INPUT") return { value: 1024, source: "config" };
      return { value: undefined, source: undefined };
    });
    (ConfigManager as unknown as { mockImplementation: (impl: () => unknown) => void }).mockImplementation(() => ({
      set: setMock,
      get: getMock
    }));

    await Cmd.handleConfigSet(
      ["AIGCM_MODEL_ID=gpt-4o", "AIGCM_ONE_LINE_COMMIT=true", "AIGCM_MAX_TOKEN_INPUT=1024"],
      {}
    );
    expect(setMock).toHaveBeenCalledTimes(3);
    // 现在 CLI 层直接传递字符串，由 ConfigManager 负责转换
    expect(setMock).toHaveBeenNthCalledWith(1, "AIGCM_MODEL_ID", "gpt-4o");
    expect(setMock).toHaveBeenNthCalledWith(2, "AIGCM_ONE_LINE_COMMIT", "true");
    expect(setMock).toHaveBeenNthCalledWith(3, "AIGCM_MAX_TOKEN_INPUT", "1024");
  });

  it("get 应该读取值并打印", async () => {
    const getMock = vi.fn(() => ({ value: "gpt-4o", source: "config" }));
    (ConfigManager as unknown as { mockImplementation: (impl: () => unknown) => void }).mockImplementation(() => ({
      get: getMock
    }));
    await Cmd.handleConfigGet("AIGCM_MODEL_ID", {});
    expect(getMock).toHaveBeenCalledWith("AIGCM_MODEL_ID");
  });

  it("ls 应该列出所有的 key", async () => {
    const getAllMock = vi.fn(() => ({ AIGCM_MODEL_ID: { value: "m", source: "config" } }));
    (ConfigManager as unknown as { mockImplementation: (impl: () => unknown) => void }).mockImplementation(() => ({
      getAll: getAllMock
    }));
    await Cmd.handleConfigList({});
    expect(getAllMock).toHaveBeenCalled();
  });

  it("set 在格式错误的键值对时应该抛出异常", async () => {
    await expect(Cmd.handleConfigSet(["INVALID_KEY"], {})).rejects.toThrow("无效的参数（缺少 '='）");
  });

  it("set 在没有提供参数时应该抛出异常", async () => {
    await expect(Cmd.handleConfigSet([], {})).rejects.toThrow("请提供至少一个配置项");
  });

  it("get 应该将 CLI 环境变量转发给 ConfigManager 并优先使用 cli 来源", async () => {
    const getMock = vi.fn(() => ({ value: "cli-model", source: "cli" }));
    (ConfigManager as unknown as { mockImplementation: (impl: (args: unknown) => unknown) => void }).mockImplementation(
      (args: unknown) => {
        expect(args).toEqual({ cliEnv: { AIGCM_MODEL_ID: "cli-model" } });
        return { get: getMock } as unknown;
      }
    );
    await Cmd.handleConfigGet("AIGCM_MODEL_ID", { AIGCM_MODEL_ID: "cli-model" });
    expect(getMock).toHaveBeenCalledWith("AIGCM_MODEL_ID");
  });

  it("ls 应该将 CLI 环境变量转发给 ConfigManager", async () => {
    const getAllMock = vi.fn(() => ({ AIGCM_MODEL_ID: { value: "cli-model", source: "cli" } }));
    (ConfigManager as unknown as { mockImplementation: (impl: (args: unknown) => unknown) => void }).mockImplementation(
      (args: unknown) => {
        expect(args).toEqual({ cliEnv: { AIGCM_MODEL_ID: "cli-model" } });
        return { getAll: getAllMock } as unknown;
      }
    );
    await Cmd.handleConfigList({ AIGCM_MODEL_ID: "cli-model" });
    expect(getAllMock).toHaveBeenCalled();
  });

  it("应该过滤非 AIGCM_ 前缀的环境变量", async () => {
    const getMock = vi.fn(() => ({ value: "test", source: "cli" }));
    (ConfigManager as unknown as { mockImplementation: (impl: (args: unknown) => unknown) => void }).mockImplementation(
      (args: unknown) => {
        // 验证只有 AIGCM_ 前缀的变量被传入
        expect(args).toEqual({ cliEnv: { AIGCM_MODEL_ID: "gpt-4o" } });
        return { get: getMock } as unknown;
      }
    );
    // 传入多个环境变量，包括非 AIGCM_ 前缀的
    await Cmd.handleConfigGet("AIGCM_MODEL_ID", {
      AIGCM_MODEL_ID: "gpt-4o",
      PATH: "/usr/bin",
      HOME: "/home/user",
      RANDOM_VAR: "random"
    });
    expect(getMock).toHaveBeenCalled();
  });
});
