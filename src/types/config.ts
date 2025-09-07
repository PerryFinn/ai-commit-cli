/**
 * 配置类型与 JSON Schema 定义
 * 说明：本文件定义了 CLI 的 11 个配置项、对应的 TypeScript 类型、
 * 允许的枚举值以及运行时用于 conf 校验的 JSON Schema。
 */

/**
 * 可用的大语言模型提供商
 */
export enum LLMProvider {
  OPEN_AI = "OPEN_AI",
  OLLAMA = "OLLAMA",
  GEMINI = "GEMINI",
  DIFY = "DIFY"
}

/**
 * 语言枚举
 */
export enum Language {
  zh_CN = "zh_CN",
  en = "en"
}

/**
 * 配置 Schema 接口（所有字段均为可选，按需填写）
 */
export interface ConfigSchema {
  /** 模型 ID，例如 gpt-4o, qwen, llama3, gemini-pro 等 */
  AIGCM_MODEL_ID?: string;
  /** LLM 提供商：OPEN_AI | OLLAMA | GEMINI | DIFY */
  AIGCM_LLM_PROVIDER?: LLMProvider;
  /** Dify 应用的 Auth ID（若使用 Dify 时必填） */
  AIGCM_DIFY_AUTH_ID?: string;
  /** 提示词模块（自定义字符串标识） */
  AIGCM_PROMPT_MODULE?: string;
  /** 语言：zh_CN | en */
  AIGCM_LANGUAGE?: Language;
  /** 是否生成单行提交信息（true/false） */
  AIGCM_ONE_LINE_COMMIT?: boolean;
  /** 提交信息是否省略 scope（true/false） */
  AIGCM_OMIT_COMMIT_SCOPE?: boolean;
  /** 输入 Token 上限（正整数） */
  AIGCM_MAX_TOKEN_INPUT?: number;
  /** 输出 Token 上限（正整数） */
  AIGCM_MAX_TOKEN_OUTPUT?: number;
  /** API Key（根据提供商不同而不同） */
  AIGCM_API_KEY?: string;
  /** API Base URL（某些提供商或私有部署需要） */
  AIGCM_BASE_URL?: string;
}

/**
 * JSON Schema 属性类型（用于运行时校验）
 */
export type JSONSchemaProperty = {
  type: "string" | "number" | "boolean";
  enum?: readonly unknown[];
  minimum?: number;
};

/**
 * 配置键常量数组，便于运行时遍历与校验
 */
export const CONFIG_KEYS = [
  "AIGCM_MODEL_ID",
  "AIGCM_LLM_PROVIDER",
  "AIGCM_DIFY_AUTH_ID",
  "AIGCM_PROMPT_MODULE",
  "AIGCM_LANGUAGE",
  "AIGCM_ONE_LINE_COMMIT",
  "AIGCM_OMIT_COMMIT_SCOPE",
  "AIGCM_MAX_TOKEN_INPUT",
  "AIGCM_MAX_TOKEN_OUTPUT",
  "AIGCM_API_KEY",
  "AIGCM_BASE_URL"
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

/**
 * 可复用的属性定义映射，供 conf.schema 与运行时类型推断使用
 */
export const configProperties: Record<ConfigKey, JSONSchemaProperty> = {
  AIGCM_MODEL_ID: { type: "string" },
  AIGCM_LLM_PROVIDER: { type: "string", enum: Object.values(LLMProvider) },
  AIGCM_DIFY_AUTH_ID: { type: "string" },
  AIGCM_PROMPT_MODULE: { type: "string" },
  AIGCM_LANGUAGE: { type: "string", enum: Object.values(Language) },
  AIGCM_ONE_LINE_COMMIT: { type: "boolean" },
  AIGCM_OMIT_COMMIT_SCOPE: { type: "boolean" },
  AIGCM_MAX_TOKEN_INPUT: { type: "number", minimum: 0 },
  AIGCM_MAX_TOKEN_OUTPUT: { type: "number", minimum: 0 },
  AIGCM_API_KEY: { type: "string" },
  AIGCM_BASE_URL: { type: "string" }
} as const;

/**
 * JSON Schema（与上面的接口对齐）
 * 说明：用于 conf 在运行时做基础校验。
 */
export const configJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: configProperties
} as const;
