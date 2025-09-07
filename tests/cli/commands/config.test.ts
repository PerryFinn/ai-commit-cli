import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Cmd from "@/cli/commands/config";
import { ConfigManager } from "@/config/ConfigManager";

vi.mock("@/config/ConfigManager");

describe("CLI config commands", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("set should parse key=value and call manager.set", async () => {
    const setMock = vi.fn();
    (ConfigManager as unknown as { mockImplementation: (impl: () => unknown) => void }).mockImplementation(() => ({
      set: setMock
    }));

    await Cmd.handleConfigSet(
      ["AIGCM_MODEL_ID=gpt-4o", "AIGCM_ONE_LINE_COMMIT=true", "AIGCM_MAX_TOKEN_INPUT=1024"],
      {}
    );
    expect(setMock).toHaveBeenCalledTimes(3);
    expect(setMock).toHaveBeenNthCalledWith(1, "AIGCM_MODEL_ID", "gpt-4o");
    expect(setMock).toHaveBeenNthCalledWith(2, "AIGCM_ONE_LINE_COMMIT", true);
    expect(setMock).toHaveBeenNthCalledWith(3, "AIGCM_MAX_TOKEN_INPUT", 1024);
  });

  it("get should read value and print", async () => {
    const getMock = vi.fn(() => ({ value: "gpt-4o", source: "config" }));
    (ConfigManager as unknown as { mockImplementation: (impl: () => unknown) => void }).mockImplementation(() => ({
      get: getMock
    }));
    await Cmd.handleConfigGet("AIGCM_MODEL_ID", {});
    expect(getMock).toHaveBeenCalledWith("AIGCM_MODEL_ID");
  });

  it("ls should list all keys", async () => {
    const getAllMock = vi.fn(() => ({ AIGCM_MODEL_ID: { value: "m", source: "config" } }));
    (ConfigManager as unknown as { mockImplementation: (impl: () => unknown) => void }).mockImplementation(() => ({
      getAll: getAllMock
    }));
    await Cmd.handleConfigList({});
    expect(getAllMock).toHaveBeenCalled();
  });

  it("set should error on malformed pair", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await Cmd.handleConfigSet(["INVALID"], {});
    spy.mockRestore();
  });

  it("get should forward CLI env to ConfigManager and prefer cli source", async () => {
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

  it("ls should forward CLI env to ConfigManager", async () => {
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
});
