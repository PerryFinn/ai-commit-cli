import { describe, expect, it } from "vitest";
import { ConfigValidator, ValidationContext, ValidationErrorType } from "@/config/config-validator";
import { type ConfigSchema, Language, LLMProvider } from "@/types/config";

describe("ConfigValidator - 单元测试", () => {
  const validator = new ConfigValidator();

  describe("基础验证", () => {
    it("空配置应该通过基础验证", () => {
      const result = validator.validate({}, ValidationContext.Basic);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("完整配置应该通过验证", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
        AIGCM_MODEL_ID: "gpt-4o",
        AIGCM_API_KEY: "sk-xxx",
        AIGCM_LANGUAGE: Language.zh_CN
      };
      const result = validator.validate(config, ValidationContext.Basic);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Provider 依赖验证", () => {
    it("使用 Dify 但未配置 AUTH_ID 时应该报错", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_LLM_PROVIDER: LLMProvider.DIFY,
        AIGCM_MODEL_ID: "dify-model"
      };
      const result = validator.validate(config, ValidationContext.Basic);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.type).toBe(ValidationErrorType.MissingRequired);
      expect(result.errors[0]?.field).toBe("AIGCM_DIFY_AUTH_ID");
    });

    it("使用 Dify 且配置了 AUTH_ID 时应该通过", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_LLM_PROVIDER: LLMProvider.DIFY,
        AIGCM_MODEL_ID: "dify-model",
        AIGCM_DIFY_AUTH_ID: "auth-xxx"
      };
      const result = validator.validate(config, ValidationContext.Basic);
      expect(result.valid).toBe(true);
    });

    it("使用 OpenAI 但未配置 API_KEY 时应该报错", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
        AIGCM_MODEL_ID: "gpt-4o"
      };
      const result = validator.validate(config, ValidationContext.Basic);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.field).toBe("AIGCM_API_KEY");
    });

    it("使用 Gemini 但未配置 API_KEY 时应该报错", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_LLM_PROVIDER: LLMProvider.GEMINI,
        AIGCM_MODEL_ID: "gemini-pro"
      };
      const result = validator.validate(config, ValidationContext.Basic);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.field).toBe("AIGCM_API_KEY");
    });

    it("使用 OpenAI 且配置了 API_KEY 时应该通过", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
        AIGCM_MODEL_ID: "gpt-4o",
        AIGCM_API_KEY: "sk-xxx"
      };
      const result = validator.validate(config, ValidationContext.Basic);
      expect(result.valid).toBe(true);
    });
  });

  describe("CommitGeneration 上下文验证", () => {
    it("缺少 Provider 时应该报错", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_MODEL_ID: "gpt-4o",
        AIGCM_API_KEY: "sk-xxx"
      };
      const result = validator.validate(config, ValidationContext.CommitGeneration);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "AIGCM_LLM_PROVIDER")).toBe(true);
    });

    it("缺少 Model ID 时应该报错", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
        AIGCM_API_KEY: "sk-xxx"
      };
      const result = validator.validate(config, ValidationContext.CommitGeneration);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "AIGCM_MODEL_ID")).toBe(true);
    });

    it("缺少 Language 时应该给出警告", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
        AIGCM_MODEL_ID: "gpt-4o",
        AIGCM_API_KEY: "sk-xxx"
      };
      const result = validator.validate(config, ValidationContext.CommitGeneration);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.field === "AIGCM_LANGUAGE")).toBe(true);
    });

    it("缺少 MAX_TOKEN_INPUT 时应该给出警告", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
        AIGCM_MODEL_ID: "gpt-4o",
        AIGCM_API_KEY: "sk-xxx",
        AIGCM_LANGUAGE: Language.zh_CN
      };
      const result = validator.validate(config, ValidationContext.CommitGeneration);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.field === "AIGCM_MAX_TOKEN_INPUT")).toBe(true);
    });

    it("完整配置应该通过且无警告", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
        AIGCM_MODEL_ID: "gpt-4o",
        AIGCM_API_KEY: "sk-xxx",
        AIGCM_LANGUAGE: Language.zh_CN,
        AIGCM_MAX_TOKEN_INPUT: 4096,
        AIGCM_MAX_TOKEN_OUTPUT: 1024
      };
      const result = validator.validate(config, ValidationContext.CommitGeneration);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("canGenerateCommit", () => {
    it("配置完整时应该返回 true", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
        AIGCM_MODEL_ID: "gpt-4o",
        AIGCM_API_KEY: "sk-xxx"
      };
      expect(validator.canGenerateCommit(config)).toBe(true);
    });

    it("配置不完整时应该返回 false", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_MODEL_ID: "gpt-4o"
      };
      expect(validator.canGenerateCommit(config)).toBe(false);
    });
  });

  describe("extractValues", () => {
    it("应该正确提取配置值", () => {
      const allConfig = {
        AIGCM_MODEL_ID: { value: "gpt-4o", source: "config" },
        AIGCM_API_KEY: { value: "sk-xxx", source: "cli" },
        AIGCM_LANGUAGE: { value: undefined, source: undefined }
      };

      const result = ConfigValidator.extractValues(allConfig);

      expect(result.AIGCM_MODEL_ID).toBe("gpt-4o");
      expect(result.AIGCM_API_KEY).toBe("sk-xxx");
      expect(result.AIGCM_LANGUAGE).toBeUndefined();
    });
  });

  describe("错误信息", () => {
    it("错误应该包含修复建议", () => {
      const config: Partial<ConfigSchema> = {
        AIGCM_LLM_PROVIDER: LLMProvider.DIFY
      };
      const result = validator.validate(config, ValidationContext.Basic);

      expect(result.errors[0]?.suggestion).toBeDefined();
      expect(result.errors[0]?.suggestion).toContain("aigcm config set");
    });
  });
});
