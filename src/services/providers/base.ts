import type { ConfigSchema } from "@/types/config";

/**
 * LLM 生成选项
 */
export interface GenerateOptions {
  /** 最大输入 token 数 */
  maxInputTokens?: number;
  /** 最大输出 token 数 */
  maxOutputTokens?: number;
  /** 温度参数 (0-1)，越高越随机 */
  temperature?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * LLM 生成结果
 */
export interface GenerateResult {
  /** 生成的文本内容 */
  content: string;
  /** 使用的 token 数（如果可用） */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** 模型 ID */
  model?: string;
  /** 完成原因 */
  finishReason?: string;
}

/**
 * Provider 配置
 */
export interface ProviderConfig {
  /** API Key */
  apiKey: string;
  /** 模型 ID */
  modelId: string;
  /** API Base URL（可选，用于私有部署或代理） */
  baseUrl?: string;
  /** 额外配置（Provider 特定） */
  extra?: Record<string, unknown>;
}

/**
 * LLM Provider 接口
 * 所有 Provider 实现都需要遵循此接口
 */
export interface LLMProvider {
  /** Provider 名称 */
  readonly name: string;

  /**
   * 生成文本
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 生成结果
   */
  generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;

  /**
   * 验证配置是否完整
   * @param config 配置对象
   * @returns 配置是否有效
   */
  validateConfig(config: Partial<ConfigSchema>): boolean;
}

/**
 * Provider 基类
 * 提供通用功能实现
 */
export abstract class BaseProvider implements LLMProvider {
  abstract readonly name: string;
  protected readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;

  abstract validateConfig(config: Partial<ConfigSchema>): boolean;

  /**
   * 发送 HTTP 请求的通用方法
   */
  protected async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number = 30000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 构建通用请求头
   */
  protected buildHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...extraHeaders
    };
  }
}
