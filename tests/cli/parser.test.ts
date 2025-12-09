import { beforeEach, describe, expect, it, vi } from "vitest";
import * as configCommands from "@/cli/commands/config";
import { runCLI } from "@/cli/parser";

vi.mock("@/cli/commands/config");

describe("CLI parser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("runCLI", () => {
    it("当提供 help 标志时，应该返回 0", async () => {
      const code = await runCLI(["--help"]);
      expect(code).toBe(0);
    });

    // TODO：有待商榷，在实际使用中，如果没有提供命令，应该有什么默认交互
    // it("当没有提供命令时，应该返回 0", async () => {
    //   const code = await runCLI([]);
    //   expect(code).toBe(0);
    // });

    it("对于未知的命令，应该返回 1", async () => {
      const code = await runCLI(["unknown"]);
      expect(code).toBe(1);
    });
  });

  describe("config 命令", () => {
    it("当 config set 成功时，应该返回 0", async () => {
      vi.mocked(configCommands.handleConfigSet).mockResolvedValue();
      const code = await runCLI(["config", "set", "AIGCM_MODEL_ID=gpt-4o"]);
      expect(code).toBe(0);
      expect(configCommands.handleConfigSet).toHaveBeenCalled();
    });

    it("当 config set 失败时，应该返回 1", async () => {
      vi.mocked(configCommands.handleConfigSet).mockRejectedValue(new Error("Invalid config"));
      const code = await runCLI(["config", "set", "INVALID"]);
      expect(code).toBe(1);
    });

    it("当 config get 成功时，应该返回 0", async () => {
      vi.mocked(configCommands.handleConfigGet).mockResolvedValue();
      const code = await runCLI(["config", "get", "AIGCM_MODEL_ID"]);
      expect(code).toBe(0);
      expect(configCommands.handleConfigGet).toHaveBeenCalled();
    });

    it("当 config get 失败时，应该返回 1", async () => {
      vi.mocked(configCommands.handleConfigGet).mockRejectedValue(new Error("Config read error"));
      const code = await runCLI(["config", "get", "AIGCM_MODEL_ID"]);
      expect(code).toBe(1);
    });

    it("当 config get 没有提供 key 参数时，应该返回 1", async () => {
      const code = await runCLI(["config", "get"]);
      expect(code).toBe(1);
    });

    it("当 config ls 成功时，应该返回 0", async () => {
      vi.mocked(configCommands.handleConfigList).mockResolvedValue();
      const code = await runCLI(["config", "ls"]);
      expect(code).toBe(0);
      expect(configCommands.handleConfigList).toHaveBeenCalled();
    });

    it("当 config list (别名) 成功时，应该返回 0", async () => {
      vi.mocked(configCommands.handleConfigList).mockResolvedValue();
      const code = await runCLI(["config", "list"]);
      expect(code).toBe(0);
      expect(configCommands.handleConfigList).toHaveBeenCalled();
    });

    it("当 config ls 失败时，应该返回 1", async () => {
      vi.mocked(configCommands.handleConfigList).mockRejectedValue(new Error("List error"));
      const code = await runCLI(["config", "ls"]);
      expect(code).toBe(1);
    });

    it("对于未知的 config 子命令，应该返回 1", async () => {
      const code = await runCLI(["config", "unknown"]);
      expect(code).toBe(1);
    });

    it("当 config 没有提供子命令时，应该返回 1", async () => {
      const code = await runCLI(["config"]);
      expect(code).toBe(1);
    });
  });
});
