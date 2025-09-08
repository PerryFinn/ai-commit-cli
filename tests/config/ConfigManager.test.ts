import fs from "node:fs";
import path from "node:path";
import Conf from "conf";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigManager } from "@/config/ConfigManager";
import { type ConfigSchema, Language, LLMProvider } from "@/types/config";

vi.mock("conf");

describe("ConfigManager", () => {
  const createMockConf = () => {
    const data: Record<string, unknown> = {};
    return {
      get: vi.fn((k: string) => data[k]),
      set: vi.fn((k: string, v: unknown) => {
        data[k] = v;
      }),
      has: vi.fn((k: string) => k in data),
      get all() {
        return data as ConfigSchema;
      }
    } as unknown as Conf<ConfigSchema>;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (Conf as unknown as { mockImplementation: (impl: () => unknown) => void }).mockImplementation(() =>
      createMockConf()
    );
  });

  it("should set and get config from store", () => {
    const mgr = new ConfigManager();
    mgr.set("AIGCM_MODEL_ID", "gpt-4o");
    expect(mgr.get("AIGCM_MODEL_ID").value).toBe("gpt-4o");
    expect(mgr.get("AIGCM_MODEL_ID").source).toBe("config");
  });

  it("should respect CLI env over .env and config", () => {
    const mgr = new ConfigManager({ cliEnv: { AIGCM_MODEL_ID: "cli-model" } });
    mgr.set("AIGCM_MODEL_ID", "config-model");
    expect(mgr.get("AIGCM_MODEL_ID").value).toBe("cli-model");
    expect(mgr.get("AIGCM_MODEL_ID").source).toBe("cli");
  });

  it("should coerce boolean and number types from env", () => {
    const mgr = new ConfigManager({
      cliEnv: { AIGCM_ONE_LINE_COMMIT: "true", AIGCM_MAX_TOKEN_INPUT: "2048" }
    });
    expect(mgr.get("AIGCM_ONE_LINE_COMMIT").value).toBe(true);
    expect(mgr.get("AIGCM_MAX_TOKEN_INPUT").value).toBe(2048);
  });

  it("should validate enum values for provider and language when setting", () => {
    const mgr = new ConfigManager();
    mgr.set("AIGCM_LLM_PROVIDER", LLMProvider.OPEN_AI);
    mgr.set("AIGCM_LANGUAGE", Language.zh_CN);
    expect(mgr.get("AIGCM_LLM_PROVIDER").value).toBe(LLMProvider.OPEN_AI);
    expect(mgr.get("AIGCM_LANGUAGE").value).toBe(Language.zh_CN);
  });

  it("should reject invalid types on set", () => {
    const mgr = new ConfigManager();
    expect(() => mgr.set("AIGCM_ONE_LINE_COMMIT", "yes" as unknown as boolean)).toThrow();
    expect(() => mgr.set("AIGCM_MAX_TOKEN_INPUT", "100" as unknown as number)).toThrow();
  });

  it("getAll should include sources", () => {
    const mgr = new ConfigManager({ cliEnv: { AIGCM_API_KEY: "k" } });
    mgr.set("AIGCM_MODEL_ID", "m");
    const all = mgr.getAll();
    expect(all.AIGCM_API_KEY.source).toBe("cli");
    expect(all.AIGCM_MODEL_ID.source).toBe("config");
  });

  it("should load values from .env file", () => {
    const envPath = path.join(process.cwd(), ".env");
    const original = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : undefined;

    try {
      fs.writeFileSync(envPath, "AIGCM_MODEL_ID=dotenv-model");

      const mgr = new ConfigManager();
      expect(mgr.get("AIGCM_MODEL_ID").value).toBe("dotenv-model");
      expect(mgr.get("AIGCM_MODEL_ID").source).toBe(".env");
    } finally {
      if (original !== undefined) {
        fs.writeFileSync(envPath, original);
      } else {
        fs.unlinkSync(envPath);
      }
    }
  });
});
