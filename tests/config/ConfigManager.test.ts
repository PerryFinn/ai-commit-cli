import Conf from "conf";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigManager } from "@/config/ConfigManager";
import { type ConfigSchema, Language, LLMProvider } from "@/types/config";

// 关键点1: 模拟 'conf' 模块
// 这行代码告诉 Vitest 拦截所有对 'conf' 模块的导入请求。
// 它不会加载真实的 'conf' 库（该库会与文件系统交互），
// 而是用一个可配置的模拟版本来代替。
// 这使得我们的测试可以独立于文件系统，从而更快、更稳定。
vi.mock("conf");

describe("ConfigManager - 单元测试", () => {
  // 这是一个工厂函数，用于创建一个模拟的 `conf` 实例。
  // 它模仿了真实 `conf` 实例的 API（如 get, set, has, all），
  // 但所有操作都只在内存中的 `data` 对象上进行。
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

  // 关键点2: 在每个测试前进行设置
  beforeEach(() => {
    // 重置所有模拟，确保测试之间是相互独立的。
    vi.resetAllMocks();
    // 这是将模拟连接起来的核心部分。
    // 它告诉 Vitest：当代码中执行 `new Conf()` 时，
    // 不要调用真实的构造函数，而是调用我们的 `createMockConf` 工厂函数。
    // 因此，ConfigManager 内部的 `this.store` 将会是我们在内存中创建的模拟对象。
    (Conf as unknown as { mockImplementation: (impl: () => unknown) => void }).mockImplementation(() =>
      createMockConf()
    );
  });

  it("应该能从存储中设置和获取配置", () => {
    // 由于上面的模拟，这里的 `new ConfigManager()` 会使用我们内存中的 mock store。
    const mgr = new ConfigManager();
    mgr.set("AIGCM_MODEL_ID", "gpt-4o");
    expect(mgr.get("AIGCM_MODEL_ID").value).toBe("gpt-4o");
    expect(mgr.get("AIGCM_MODEL_ID").source).toBe("config");
  });

  // 这个测试验证了 ConfigManager 的核心逻辑之一：配置源的优先级。
  // 它检查来自 CLI 的环境变量（cliEnv）是否能正确覆盖通过 .set() 设置的常规配置。
  // 因为我们模拟了 `conf`，这个测试可以精准地验证这个逻辑，而无需关心文件或真实环境变量。
  it("应该优先使用CLI环境变量，而不是.env或配置文件", () => {
    const mgr = new ConfigManager({ cliEnv: { AIGCM_MODEL_ID: "cli-model" } });
    mgr.set("AIGCM_MODEL_ID", "config-model");
    expect(mgr.get("AIGCM_MODEL_ID").value).toBe("cli-model");
    expect(mgr.get("AIGCM_MODEL_ID").source).toBe("cli");
  });

  it("应该能将环境变量中的布尔值和数字字符串正确转换为对应的类型", () => {
    const mgr = new ConfigManager({
      cliEnv: { AIGCM_ONE_LINE_COMMIT: "true", AIGCM_MAX_TOKEN_INPUT: "2048" }
    });
    expect(mgr.get("AIGCM_ONE_LINE_COMMIT").value).toBe(true);
    expect(mgr.get("AIGCM_MAX_TOKEN_INPUT").value).toBe(2048);
  });

  it("设置时应该验证 provider 和 language 的枚举值", () => {
    const mgr = new ConfigManager();
    mgr.set("AIGCM_LLM_PROVIDER", LLMProvider.OPEN_AI);
    mgr.set("AIGCM_LANGUAGE", Language.zh_CN);
    expect(mgr.get("AIGCM_LLM_PROVIDER").value).toBe(LLMProvider.OPEN_AI);
    expect(mgr.get("AIGCM_LANGUAGE").value).toBe(Language.zh_CN);
  });

  it("设置时应该拒绝无效的类型", () => {
    const mgr = new ConfigManager();
    expect(() => mgr.set("AIGCM_ONE_LINE_COMMIT", "yes" as unknown as boolean)).toThrow();
    expect(() => mgr.set("AIGCM_MAX_TOKEN_INPUT", "100" as unknown as number)).toThrow();
  });

  it("getAll 方法返回的结果应该包含配置的来源", () => {
    const mgr = new ConfigManager({ cliEnv: { AIGCM_API_KEY: "k" } });
    mgr.set("AIGCM_MODEL_ID", "m");
    const all = mgr.getAll();
    expect(all.AIGCM_API_KEY.source).toBe("cli");
    expect(all.AIGCM_MODEL_ID.source).toBe("config");
  });
});
