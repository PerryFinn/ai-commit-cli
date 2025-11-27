import type { ConfigSchema } from "@/types/config";
import { NetworkError } from "@/types/errors";
import { BaseProvider, type GenerateOptions, type GenerateResult, type ProviderConfig } from "./base";

/**
 * Dify API 响应类型（阻塞模式）
 */
interface DifyResponse {
  event: string;
  task_id: string;
  id: string;
  message_id: string;
  conversation_id: string;
  mode: string;
  answer: string;
  metadata: {
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
  created_at: number;
}

/**
 * Dify API 错误响应类型
 */
interface DifyErrorResponse {
  code: string;
  message: string;
  status: number;
}

const DEFAULT_BASE_URL = "https://api.dify.ai/v1";
const DEFAULT_TIMEOUT = 120000; // Dify 可能需要更长的超时时间

/**
 * Dify Provider 实现
 * 使用 Dify 平台的 Completion API（阻塞模式）
 */
export class DifyProvider extends BaseProvider {
  readonly name = "Dify";
  private readonly authId: string;

  constructor(config: ProviderConfig & { authId: string }) {
    super(config);
    this.authId = config.authId;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    const baseUrl = this.config.baseUrl ?? DEFAULT_BASE_URL;
    const url = `${baseUrl}/completion-messages`;
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

    const body = {
      inputs: {},
      query: prompt,
      response_mode: "blocking",
      user: "aigcm-cli"
    };

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: this.buildHeaders({
            Authorization: `Bearer ${this.authId}`
          }),
          body: JSON.stringify(body)
        },
        timeout
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = (await response.json()) as DifyResponse;
      return this.parseResponse(data);
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw NetworkError.timeout(timeout);
      }
      throw new NetworkError(`Dify API 请求失败: ${(error as Error).message}`);
    }
  }

  validateConfig(config: Partial<ConfigSchema>): boolean {
    return !!(config.AIGCM_DIFY_AUTH_ID && config.AIGCM_MODEL_ID);
  }

  /**
   * 解析 Dify API 响应
   */
  private parseResponse(data: DifyResponse): GenerateResult {
    if (!data.answer) {
      throw new NetworkError("Dify API 返回了空响应");
    }

    return {
      content: data.answer,
      model: this.config.modelId,
      finishReason: "stop",
      usage: data.metadata?.usage
        ? {
            promptTokens: data.metadata.usage.prompt_tokens,
            completionTokens: data.metadata.usage.completion_tokens,
            totalTokens: data.metadata.usage.total_tokens
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
      const errorData = (await response.json()) as DifyErrorResponse;
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // 忽略 JSON 解析错误
    }

    throw NetworkError.fromStatusCode(response.status, errorMessage);
  }
}

/**
 * 从配置创建 Dify Provider
 */
export function createDifyProvider(config: Partial<ConfigSchema>): DifyProvider {
  if (!config.AIGCM_DIFY_AUTH_ID) {
    throw new NetworkError("缺少 AIGCM_DIFY_AUTH_ID 配置");
  }
  if (!config.AIGCM_MODEL_ID) {
    throw new NetworkError("缺少 AIGCM_MODEL_ID 配置");
  }

  return new DifyProvider({
    apiKey: "", // Dify 使用 authId 而非 apiKey
    modelId: config.AIGCM_MODEL_ID,
    baseUrl: config.AIGCM_BASE_URL,
    authId: config.AIGCM_DIFY_AUTH_ID
  });
}
