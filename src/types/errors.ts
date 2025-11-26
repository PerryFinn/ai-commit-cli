/**
 * 错误类型层次定义
 * 用于区分不同类型的错误，便于 CLI 层进行差异化处理
 */

/**
 * 错误代码常量
 */
export const ErrorCode = {
  // 配置相关错误 (1xx)
  ConfigNotFound: "CONFIG_NOT_FOUND",
  ConfigInvalid: "CONFIG_INVALID",
  ConfigKeyUnsupported: "CONFIG_KEY_UNSUPPORTED",
  ConfigValueInvalid: "CONFIG_VALUE_INVALID",
  ConfigValidationFailed: "CONFIG_VALIDATION_FAILED",

  // 网络相关错误 (2xx)
  NetworkError: "NETWORK_ERROR",
  NetworkTimeout: "NETWORK_TIMEOUT",
  ApiError: "API_ERROR",
  ApiRateLimited: "API_RATE_LIMITED",
  ApiAuthFailed: "API_AUTH_FAILED",

  // Git 相关错误 (3xx)
  GitNotRepo: "GIT_NOT_REPO",
  GitNoStagedChanges: "GIT_NO_STAGED_CHANGES",
  GitCommitFailed: "GIT_COMMIT_FAILED",

  // 验证相关错误 (4xx)
  ValidationFailed: "VALIDATION_FAILED",
  InputInvalid: "INPUT_INVALID",

  // 通用错误 (9xx)
  Unknown: "UNKNOWN_ERROR"
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * CLI 错误基类
 * 所有自定义错误都应继承此类
 */
export class CLIError extends Error {
  readonly code: ErrorCode;
  /** 用户友好的修复建议 */
  readonly suggestion?: string;

  constructor(message: string, code: ErrorCode, suggestion?: string) {
    super(message);
    this.name = "CLIError";
    this.code = code;
    this.suggestion = suggestion;
    // 确保 instanceof 正常工作
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 配置错误
 * 用于配置读取、写入、校验失败等场景
 */
export class ConfigError extends CLIError {
  /** 相关的配置键 */
  readonly configKey?: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.ConfigInvalid,
    options?: { configKey?: string; suggestion?: string }
  ) {
    super(message, code, options?.suggestion ?? "运行 'aigcm config ls' 查看当前配置");
    this.name = "ConfigError";
    this.configKey = options?.configKey;
  }

  /**
   * 创建"不支持的配置键"错误
   */
  static unsupportedKey(key: string): ConfigError {
    return new ConfigError(`不支持的配置 key: ${key}`, ErrorCode.ConfigKeyUnsupported, {
      configKey: key,
      suggestion: "运行 'aigcm config ls' 查看支持的配置项"
    });
  }

  /**
   * 创建"配置值无效"错误
   */
  static invalidValue(key: string, expectedType: string): ConfigError {
    return new ConfigError(`配置 ${key} 需要 ${expectedType} 类型`, ErrorCode.ConfigValueInvalid, {
      configKey: key,
      suggestion: `请检查 ${key} 的值是否符合要求`
    });
  }

  /**
   * 创建"配置验证失败"错误
   */
  static validationFailed(message: string): ConfigError {
    return new ConfigError(message, ErrorCode.ConfigValidationFailed, {
      suggestion: "运行 'aigcm config validate' 检查配置完整性"
    });
  }
}

/**
 * 网络错误
 * 用于 API 调用失败、超时等场景
 */
export class NetworkError extends CLIError {
  /** HTTP 状态码 */
  readonly statusCode?: number;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.NetworkError,
    options?: { statusCode?: number; suggestion?: string }
  ) {
    super(message, code, options?.suggestion ?? "检查网络连接或 AIGCM_BASE_URL 配置");
    this.name = "NetworkError";
    this.statusCode = options?.statusCode;
  }

  /**
   * 创建"请求超时"错误
   */
  static timeout(timeoutMs: number): NetworkError {
    return new NetworkError(`请求超时 (${timeoutMs}ms)`, ErrorCode.NetworkTimeout, {
      suggestion: "请检查网络连接，或稍后重试"
    });
  }

  /**
   * 创建"API 认证失败"错误
   */
  static authFailed(): NetworkError {
    return new NetworkError("API 认证失败", ErrorCode.ApiAuthFailed, {
      statusCode: 401,
      suggestion: "请检查 AIGCM_API_KEY 是否正确"
    });
  }

  /**
   * 创建"API 限流"错误
   */
  static rateLimited(): NetworkError {
    return new NetworkError("API 请求频率超限", ErrorCode.ApiRateLimited, {
      statusCode: 429,
      suggestion: "请稍后重试，或检查 API 配额"
    });
  }

  /**
   * 从 HTTP 状态码创建错误
   */
  static fromStatusCode(statusCode: number, message?: string): NetworkError {
    if (statusCode === 401) return NetworkError.authFailed();
    if (statusCode === 429) return NetworkError.rateLimited();

    return new NetworkError(message ?? `API 请求失败 (HTTP ${statusCode})`, ErrorCode.ApiError, {
      statusCode,
      suggestion: "请检查 API 配置或稍后重试"
    });
  }
}

/**
 * Git 错误
 * 用于 Git 操作失败等场景
 */
export class GitError extends CLIError {
  constructor(message: string, code: ErrorCode = ErrorCode.GitCommitFailed, suggestion?: string) {
    super(message, code, suggestion ?? "请检查 Git 仓库状态");
    this.name = "GitError";
  }

  /**
   * 创建"不在 Git 仓库中"错误
   */
  static notInRepo(): GitError {
    return new GitError("当前目录不是 Git 仓库", ErrorCode.GitNotRepo, "请在 Git 仓库目录中运行此命令");
  }

  /**
   * 创建"没有暂存的变更"错误
   */
  static noStagedChanges(): GitError {
    return new GitError("没有暂存的变更", ErrorCode.GitNoStagedChanges, "请先使用 'git add' 暂存要提交的文件");
  }
}

/**
 * 验证错误
 * 用于输入验证失败等场景
 */
export class ValidationError extends CLIError {
  /** 验证失败的字段 */
  readonly field?: string;

  constructor(message: string, options?: { field?: string; suggestion?: string }) {
    super(message, ErrorCode.ValidationFailed, options?.suggestion);
    this.name = "ValidationError";
    this.field = options?.field;
  }

  /**
   * 创建"输入无效"错误
   */
  static invalidInput(field: string, reason: string): ValidationError {
    return new ValidationError(`${field}: ${reason}`, {
      field,
      suggestion: `请检查 ${field} 的格式`
    });
  }
}

/**
 * 判断错误是否为 CLIError 或其子类
 */
export function isCLIError(error: unknown): error is CLIError {
  return error instanceof CLIError;
}

/**
 * 将未知错误包装为 CLIError
 */
export function wrapError(error: unknown): CLIError {
  if (error instanceof CLIError) {
    return error;
  }
  if (error instanceof Error) {
    return new CLIError(error.message, ErrorCode.Unknown);
  }
  return new CLIError(String(error), ErrorCode.Unknown);
}
