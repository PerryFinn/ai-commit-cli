import { type ConfigSchema, LLMProvider as LLMProviderType } from "@/types/config";
import { ConfigError } from "@/types/errors";
import type { LLMProvider } from "./base";
import { createDifyProvider } from "./dify";
import { createGeminiProvider } from "./gemini";
import { createOpenAIProvider } from "./openai";

/**
 * Provider 工厂函数类型
 */
type ProviderFactory = (config: Partial<ConfigSchema>) => LLMProvider;

/**
 * Provider 工厂映射
 */
const providerFactories: Record<LLMProviderType, ProviderFactory> = {
  [LLMProviderType.OPEN_AI]: createOpenAIProvider,
  [LLMProviderType.GEMINI]: createGeminiProvider,
  [LLMProviderType.DIFY]: createDifyProvider
};

/**
 * 根据配置创建对应的 LLM Provider
 * @param config 配置对象
 * @returns LLM Provider 实例
 * @throws ConfigError 如果配置无效或 Provider 类型不支持
 */
export function createProvider(config: Partial<ConfigSchema>): LLMProvider {
  const providerType = config.AIGCM_LLM_PROVIDER;

  if (!providerType) {
    throw ConfigError.validationFailed("缺少 AIGCM_LLM_PROVIDER 配置");
  }

  const factory = providerFactories[providerType];
  if (!factory) {
    throw new ConfigError(`不支持的 Provider 类型: ${providerType}`, undefined, {
      configKey: "AIGCM_LLM_PROVIDER",
      suggestion: `支持的类型: ${Object.values(LLMProviderType).join(", ")}`
    });
  }

  return factory(config);
}

/**
 * 获取所有支持的 Provider 类型
 */
export function getSupportedProviders(): LLMProviderType[] {
  return Object.values(LLMProviderType);
}

/**
 * 检查 Provider 类型是否支持
 */
export function isProviderSupported(provider: string): provider is LLMProviderType {
  return Object.values(LLMProviderType).includes(provider as LLMProviderType);
}
