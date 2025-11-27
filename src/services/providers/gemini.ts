import type { ConfigSchema } from "@/types/config";
import { NetworkError } from "@/types/errors";
import { BaseProvider, type GenerateOptions, type GenerateResult } from "./base";

/**
 * Gemini API 响应类型
 */
interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
      role: string;
    };
    finishReason: string;
    index: number;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion?: string;
}

/**
 * Gemini API 错误响应类型
 */
interface GeminiErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_TIMEOUT = 60000;

/**
 * Google Gemini Provider 实现
 */
export class GeminiProvider extends BaseProvider {
  readonly name = "Gemini";

  async generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    const baseUrl = this.config.baseUrl ?? DEFAULT_BASE_URL;
    const url = `${baseUrl}/models/${this.config.modelId}:generateContent?key=${this.config.apiKey}`;
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

    const body = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        maxOutputTokens: options?.maxOutputTokens,
        temperature: options?.temperature ?? 0.7
      }
    };

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify(body)
        },
        timeout
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = (await response.json()) as GeminiResponse;
      return this.parseResponse(data);
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw NetworkError.timeout(timeout);
      }
      throw new NetworkError(`Gemini API 请求失败: ${(error as Error).message}`);
    }
  }

  validateConfig(config: Partial<ConfigSchema>): boolean {
    return !!(config.AIGCM_API_KEY && config.AIGCM_MODEL_ID);
  }

  /**
   * 解析 Gemini API 响应
   */
  private parseResponse(data: GeminiResponse): GenerateResult {
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new NetworkError("Gemini API 返回了空响应");
    }

    const content = candidate.content.parts.map((p) => p.text).join("");

    return {
      content,
      model: data.modelVersion,
      finishReason: candidate.finishReason,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount
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
      const errorData = (await response.json()) as GeminiErrorResponse;
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
 * 从配置创建 Gemini Provider
 */
export function createGeminiProvider(config: Partial<ConfigSchema>): GeminiProvider {
  if (!config.AIGCM_API_KEY) {
    throw new NetworkError("缺少 AIGCM_API_KEY 配置");
  }
  if (!config.AIGCM_MODEL_ID) {
    throw new NetworkError("缺少 AIGCM_MODEL_ID 配置");
  }

  return new GeminiProvider({
    apiKey: config.AIGCM_API_KEY,
    modelId: config.AIGCM_MODEL_ID,
    baseUrl: config.AIGCM_BASE_URL
  });
}
