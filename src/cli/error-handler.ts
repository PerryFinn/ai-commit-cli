import { log } from "@clack/prompts";
import pc from "picocolors";
import {
  type CLIError,
  ConfigError,
  GitError,
  isCLIError,
  NetworkError,
  ValidationError,
  wrapError
} from "@/types/errors";

/**
 * 统一的 CLI 错误处理器
 * 根据错误类型输出差异化的错误信息和修复建议
 */
export function handleError(error: unknown): void {
  const cliError = isCLIError(error) ? error : wrapError(error);

  // 根据错误类型输出不同格式的错误信息
  if (error instanceof ConfigError) {
    log.error(pc.red(`配置错误: ${error.message}`));
    if (error.configKey) {
      log.info(pc.dim(`相关配置项: ${error.configKey}`));
    }
  } else if (error instanceof NetworkError) {
    log.error(pc.red(`网络错误: ${cliError.message}`));
    if (error.statusCode) {
      log.info(pc.dim(`HTTP 状态码: ${error.statusCode}`));
    }
  } else if (error instanceof GitError) {
    log.error(pc.red(`Git 错误: ${cliError.message}`));
  } else if (error instanceof ValidationError) {
    log.error(pc.red(`验证错误: ${cliError.message}`));
    if (error.field) {
      log.info(pc.dim(`相关字段: ${error.field}`));
    }
  } else {
    log.error(pc.red(cliError.message));
  }

  // 输出修复建议
  if (cliError.suggestion) {
    log.info(pc.yellow(`提示: ${cliError.suggestion}`));
  }
}

/**
 * 断言条件为真，否则抛出 CLIError
 */
export function assertOrThrow(condition: boolean, error: CLIError): asserts condition {
  if (!condition) {
    throw error;
  }
}
