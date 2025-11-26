import { type ConfigSchema, LLMProvider } from "@/types/config";

/**
 * 验证错误类型
 */
export const ValidationErrorType = {
  /** 缺少必需的配置项 */
  MissingRequired: "MISSING_REQUIRED",
  /** 配置项之间存在冲突 */
  Conflict: "CONFLICT",
  /** 配置项值无效 */
  InvalidValue: "INVALID_VALUE"
} as const;

export type ValidationErrorType = (typeof ValidationErrorType)[keyof typeof ValidationErrorType];

/**
 * 验证错误信息
 */
export interface ValidationError {
  type: ValidationErrorType;
  field: string;
  message: string;
  /** 建议的修复操作 */
  suggestion?: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  /** 警告信息（不影响验证结果，但建议关注） */
  warnings: ValidationError[];
}

/**
 * 验证上下文：指定验证场景
 */
export const ValidationContext = {
  /** 完整验证（AI 提交生成功能所需） */
  CommitGeneration: "COMMIT_GENERATION",
  /** 基础验证（配置命令使用） */
  Basic: "BASIC"
} as const;

export type ValidationContext = (typeof ValidationContext)[keyof typeof ValidationContext];

/**
 * 配置验证器
 * 负责验证跨配置项的业务规则
 */
export class ConfigValidator {
  /**
   * 验证配置
   * @param config 配置对象（通常来自 ConfigManager.getAll() 的值）
   * @param context 验证上下文，决定验证的严格程度
   */
  validate(config: Partial<ConfigSchema>, context: ValidationContext = ValidationContext.Basic): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // 基础验证始终执行
    this.validateProviderDependencies(config, errors);

    // AI 提交生成场景的额外验证
    if (context === ValidationContext.CommitGeneration) {
      this.validateCommitGenerationRequirements(config, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证 Provider 相关的依赖配置
   */
  private validateProviderDependencies(config: Partial<ConfigSchema>, errors: ValidationError[]): void {
    const provider = config.AIGCM_LLM_PROVIDER;

    // Dify 必须配置 AUTH_ID
    if (provider === LLMProvider.DIFY && !config.AIGCM_DIFY_AUTH_ID) {
      errors.push({
        type: ValidationErrorType.MissingRequired,
        field: "AIGCM_DIFY_AUTH_ID",
        message: "使用 Dify 时必须配置 AIGCM_DIFY_AUTH_ID",
        suggestion: "运行: aigcm config set AIGCM_DIFY_AUTH_ID=<your-auth-id>"
      });
    }

    // OpenAI 和 Gemini 必须配置 API_KEY
    if ((provider === LLMProvider.OPEN_AI || provider === LLMProvider.GEMINI) && !config.AIGCM_API_KEY) {
      errors.push({
        type: ValidationErrorType.MissingRequired,
        field: "AIGCM_API_KEY",
        message: `使用 ${provider} 时必须配置 AIGCM_API_KEY`,
        suggestion: "运行: aigcm config set AIGCM_API_KEY=<your-api-key>"
      });
    }

    // 配置了 Dify AUTH_ID 但 Provider 不是 Dify 时给出警告（在 warnings 中）
    if (config.AIGCM_DIFY_AUTH_ID && provider && provider !== LLMProvider.DIFY) {
      // 这是一个潜在的配置错误，但不阻止执行
    }
  }

  /**
   * 验证 AI 提交生成所需的必要配置
   */
  private validateCommitGenerationRequirements(
    config: Partial<ConfigSchema>,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // 必须配置 Provider
    if (!config.AIGCM_LLM_PROVIDER) {
      errors.push({
        type: ValidationErrorType.MissingRequired,
        field: "AIGCM_LLM_PROVIDER",
        message: "必须配置 AIGCM_LLM_PROVIDER 才能生成提交信息",
        suggestion: `运行: aigcm config set AIGCM_LLM_PROVIDER=${LLMProvider.OPEN_AI}`
      });
    }

    // 必须配置 Model ID
    if (!config.AIGCM_MODEL_ID) {
      errors.push({
        type: ValidationErrorType.MissingRequired,
        field: "AIGCM_MODEL_ID",
        message: "必须配置 AIGCM_MODEL_ID 才能生成提交信息",
        suggestion: "运行: aigcm config set AIGCM_MODEL_ID=gpt-4o"
      });
    }

    // 建议配置语言（警告级别）
    if (!config.AIGCM_LANGUAGE) {
      warnings.push({
        type: ValidationErrorType.MissingRequired,
        field: "AIGCM_LANGUAGE",
        message: "未配置 AIGCM_LANGUAGE，将使用默认语言",
        suggestion: "运行: aigcm config set AIGCM_LANGUAGE=zh_CN"
      });
    }

    // Token 限制建议（警告级别）
    if (!config.AIGCM_MAX_TOKEN_INPUT) {
      warnings.push({
        type: ValidationErrorType.MissingRequired,
        field: "AIGCM_MAX_TOKEN_INPUT",
        message: "未配置 AIGCM_MAX_TOKEN_INPUT，将使用默认值",
        suggestion: "运行: aigcm config set AIGCM_MAX_TOKEN_INPUT=4096"
      });
    }
  }

  /**
   * 快捷方法：验证是否可以进行 AI 提交生成
   */
  canGenerateCommit(config: Partial<ConfigSchema>): boolean {
    const result = this.validate(config, ValidationContext.CommitGeneration);
    return result.valid;
  }

  /**
   * 从 ConfigManager.getAll() 的结果中提取配置值
   * 便捷方法，用于将 ValueWithSource 映射转换为纯值对象
   */
  static extractValues(
    allConfig: Record<string, { value: unknown; source: string | undefined }>
  ): Partial<ConfigSchema> {
    const result: Partial<ConfigSchema> = {};
    for (const [key, entry] of Object.entries(allConfig)) {
      if (entry.value !== undefined) {
        (result as Record<string, unknown>)[key] = entry.value;
      }
    }
    return result;
  }
}
