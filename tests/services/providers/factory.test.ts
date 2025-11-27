import { describe, expect, it } from "vitest";
import { DifyProvider } from "@/services/providers/dify";
import { createProvider, getSupportedProviders, isProviderSupported } from "@/services/providers/factory";
import { GeminiProvider } from "@/services/providers/gemini";
import { OpenAIProvider } from "@/services/providers/openai";
import { LLMProvider } from "@/types/config";
import { ConfigError } from "@/types/errors";

describe("Provider Factory - 单元测试", () => {
  describe("createProvider", () => {
    it("应该创建 OpenAI Provider", () => {
      const provider = createProvider({
        AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
        AIGCM_API_KEY: "sk-test",
        AIGCM_MODEL_ID: "gpt-4o"
      });

      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.name).toBe("OpenAI");
    });

    it("应该创建 Gemini Provider", () => {
      const provider = createProvider({
        AIGCM_LLM_PROVIDER: LLMProvider.GEMINI,
        AIGCM_API_KEY: "test-api-key",
        AIGCM_MODEL_ID: "gemini-pro"
      });

      expect(provider).toBeInstanceOf(GeminiProvider);
      expect(provider.name).toBe("Gemini");
    });

    it("应该创建 Dify Provider", () => {
      const provider = createProvider({
        AIGCM_LLM_PROVIDER: LLMProvider.DIFY,
        AIGCM_DIFY_AUTH_ID: "app-xxx",
        AIGCM_MODEL_ID: "dify-model"
      });

      expect(provider).toBeInstanceOf(DifyProvider);
      expect(provider.name).toBe("Dify");
    });

    it("缺少 Provider 配置时应该抛出 ConfigError", () => {
      expect(() => createProvider({})).toThrow(ConfigError);
      expect(() => createProvider({})).toThrow("缺少 AIGCM_LLM_PROVIDER");
    });

    it("不支持的 Provider 类型应该抛出 ConfigError", () => {
      expect(() =>
        createProvider({
          AIGCM_LLM_PROVIDER: "UNSUPPORTED" as LLMProvider
        })
      ).toThrow(ConfigError);
    });

    it("OpenAI 缺少 API_KEY 时应该抛出错误", () => {
      expect(() =>
        createProvider({
          AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
          AIGCM_MODEL_ID: "gpt-4o"
        })
      ).toThrow("缺少 AIGCM_API_KEY");
    });

    it("OpenAI 缺少 MODEL_ID 时应该抛出错误", () => {
      expect(() =>
        createProvider({
          AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
          AIGCM_API_KEY: "sk-test"
        })
      ).toThrow("缺少 AIGCM_MODEL_ID");
    });

    it("Dify 缺少 AUTH_ID 时应该抛出错误", () => {
      expect(() =>
        createProvider({
          AIGCM_LLM_PROVIDER: LLMProvider.DIFY,
          AIGCM_MODEL_ID: "dify-model"
        })
      ).toThrow("缺少 AIGCM_DIFY_AUTH_ID");
    });

    it("应该支持自定义 BASE_URL", () => {
      const provider = createProvider({
        AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
        AIGCM_API_KEY: "sk-test",
        AIGCM_MODEL_ID: "gpt-4o",
        AIGCM_BASE_URL: "https://custom.openai.com/v1"
      });

      expect(provider).toBeInstanceOf(OpenAIProvider);
    });
  });

  describe("getSupportedProviders", () => {
    it("应该返回所有支持的 Provider 类型", () => {
      const providers = getSupportedProviders();

      expect(providers).toContain(LLMProvider.OPEN_AI);
      expect(providers).toContain(LLMProvider.GEMINI);
      expect(providers).toContain(LLMProvider.DIFY);
      expect(providers).toHaveLength(3);
    });
  });

  describe("isProviderSupported", () => {
    it("对支持的 Provider 应该返回 true", () => {
      expect(isProviderSupported("OPEN_AI")).toBe(true);
      expect(isProviderSupported("GEMINI")).toBe(true);
      expect(isProviderSupported("DIFY")).toBe(true);
    });

    it("对不支持的 Provider 应该返回 false", () => {
      expect(isProviderSupported("UNSUPPORTED")).toBe(false);
      expect(isProviderSupported("")).toBe(false);
      expect(isProviderSupported("openai")).toBe(false); // 大小写敏感
    });
  });
});

describe("Provider validateConfig - 单元测试", () => {
  it("OpenAI validateConfig 应该正确验证配置", () => {
    const provider = createProvider({
      AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
      AIGCM_API_KEY: "sk-test",
      AIGCM_MODEL_ID: "gpt-4o"
    }) as OpenAIProvider;

    expect(provider.validateConfig({ AIGCM_API_KEY: "key", AIGCM_MODEL_ID: "model" })).toBe(true);
    expect(provider.validateConfig({ AIGCM_API_KEY: "key" })).toBe(false);
    expect(provider.validateConfig({ AIGCM_MODEL_ID: "model" })).toBe(false);
    expect(provider.validateConfig({})).toBe(false);
  });

  it("Gemini validateConfig 应该正确验证配置", () => {
    const provider = createProvider({
      AIGCM_LLM_PROVIDER: LLMProvider.GEMINI,
      AIGCM_API_KEY: "test-key",
      AIGCM_MODEL_ID: "gemini-pro"
    }) as GeminiProvider;

    expect(provider.validateConfig({ AIGCM_API_KEY: "key", AIGCM_MODEL_ID: "model" })).toBe(true);
    expect(provider.validateConfig({})).toBe(false);
  });

  it("Dify validateConfig 应该正确验证配置", () => {
    const provider = createProvider({
      AIGCM_LLM_PROVIDER: LLMProvider.DIFY,
      AIGCM_DIFY_AUTH_ID: "app-xxx",
      AIGCM_MODEL_ID: "dify-model"
    }) as DifyProvider;

    expect(provider.validateConfig({ AIGCM_DIFY_AUTH_ID: "auth", AIGCM_MODEL_ID: "model" })).toBe(true);
    expect(provider.validateConfig({ AIGCM_DIFY_AUTH_ID: "auth" })).toBe(false);
    expect(provider.validateConfig({})).toBe(false);
  });
});
