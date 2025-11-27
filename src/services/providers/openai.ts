import type { ConfigSchema } from "@/types/config";
import { NetworkError } from "@/types/errors";
import { BaseProvider, type GenerateOptions, type GenerateResult } from "./base";

/**
 * OpenAI API 响应类型
 */
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI API 错误响应类型
 */
interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TIMEOUT = 60000; // 60 秒

/**
 * OpenAI Provider 实现
 * 支持 OpenAI API 及兼容的 API（如 Azure OpenAI、Ollama 等）
 */
export class OpenAIProvider extends BaseProvider {
  readonly name = "OpenAI";

  async generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    const url = `${this.config.baseUrl ?? DEFAULT_BASE_URL}/chat/completions`;
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

    const body = {
      model: this.config.modelId,
      messages: [{ role: "user", content: prompt }],
      max_tokens: options?.maxOutputTokens,
      temperature: options?.temperature ?? 0.7
    };

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: this.buildHeaders({
            Authorization: `Bearer ${this.config.apiKey}`
          }),
          body: JSON.stringify(body)
        },
        timeout
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = (await response.json()) as OpenAIResponse;
      return this.parseResponse(data);
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw NetworkError.timeout(timeout);
      }
      throw new NetworkError(`OpenAI API 请求失败: ${(error as Error).message}`);
    }
  }

  validateConfig(config: Partial<ConfigSchema>): boolean {
    return !!(config.AIGCM_API_KEY && config.AIGCM_MODEL_ID);
  }

  /**
   * 解析 OpenAI API 响应
   */
  private parseResponse(data: OpenAIResponse): GenerateResult {
    const choice = data.choices[0];
    if (!choice) {
      throw new NetworkError("OpenAI API 返回了空响应");
    }

    return {
      content: choice.message.content,
      model: data.model,
      finishReason: choice.finish_reason,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens
          }
        : undefined
    };
  }

  /**
   * 处理错误响应
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}`;

    try {
      const errorData = (await response.json()) as OpenAIErrorResponse;
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      }
    } catch {
      // 忽略 JSON 解析错误
    }

    throw NetworkError.fromStatusCode(response.status, errorMessage);
  }
}

/**
 * 从配置创建 OpenAI Provider
 */
export function createOpenAIProvider(config: Partial<ConfigSchema>): OpenAIProvider {
  if (!config.AIGCM_API_KEY) {
    throw new NetworkError("缺少 AIGCM_API_KEY 配置");
  }
  if (!config.AIGCM_MODEL_ID) {
    throw new NetworkError("缺少 AIGCM_MODEL_ID 配置");
  }

  return new OpenAIProvider({
    apiKey: config.AIGCM_API_KEY,
    modelId: config.AIGCM_MODEL_ID,
    baseUrl: config.AIGCM_BASE_URL
  });
}
