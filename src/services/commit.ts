/**
 * 提交信息生成服务
 * 负责协调 Git 操作、Provider 调用和提交信息生成
 */

import type { ConfigSchema } from "@/types/config";
import { GitError, ValidationError } from "@/types/errors";
import { GitService, type GitStatus } from "@/utils/git";
import { tokenCount } from "@/utils/prompt";
import {
  buildMultiplePrompt,
  buildPrompt,
  extractPromptOptions,
  type PromptContext,
  parseCommitMessages,
  truncateDiff
} from "./prompt";
import type { GenerateOptions, GenerateResult } from "./providers/base";
import { createProvider } from "./providers/factory";

/**
 * 提交信息生成选项
 */
export interface CommitGenerateOptions {
  /** 生成候选数量（1 表示只生成一条） */
  candidateCount?: number;
  /** 是否模拟运行（不实际提交） */
  dryRun?: boolean;
  /** 自定义 Git 工作目录 */
  cwd?: string;
}

/**
 * 提交信息生成结果
 */
export interface CommitGenerateResult {
  /** 候选提交信息列表 */
  candidates: string[];
  /** Git 状态信息 */
  gitStatus: GitStatus;
  /** LLM 响应信息 */
  llmResult?: GenerateResult;
}

/**
 * 提交执行结果
 */
export interface CommitExecuteResult {
  /** 是否成功 */
  success: boolean;
  /** 提交信息 */
  message: string;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 提交信息生成服务类
 */
export class CommitService {
  private readonly config: ConfigSchema;
  private readonly gitService: GitService;

  constructor(config: ConfigSchema, cwd?: string) {
    this.config = config;
    this.gitService = new GitService(cwd);
  }

  /**
   * 检查是否可以生成提交信息
   * 验证 Git 状态和配置完整性
   */
  validatePrerequisites(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 1. 检查是否在 Git 仓库中
    if (!this.gitService.isInsideRepo()) {
      errors.push("Not inside a Git repository");
    }

    // 2. 检查是否有暂存的变更
    const status = this.gitService.getStatus();
    if (status.isRepo && !status.hasStagedChanges) {
      errors.push("No staged changes. Use 'git add' to stage changes first");
    }

    // 3. 检查必要的配置
    if (!this.config.AIGCM_LLM_PROVIDER) {
      errors.push("LLM provider is not configured. Use 'aigcm config set AIGCM_LLM_PROVIDER <provider>'");
    }

    if (!this.config.AIGCM_API_KEY) {
      errors.push("API key is not configured. Use 'aigcm config set AIGCM_API_KEY <key>'");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 生成提交信息候选
   */
  async generateCommitMessage(options: CommitGenerateOptions = {}): Promise<CommitGenerateResult> {
    const { candidateCount = 3 } = options;

    // 1. 验证前置条件
    const validation = this.validatePrerequisites();
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join("; "));
    }

    // 2. 获取 Git 信息
    const gitStatus = this.gitService.getStatus();
    if (!gitStatus.isRepo) {
      throw new GitError("Not inside a Git repository");
    }

    const stagedFiles = this.gitService.getStagedFiles();
    if (stagedFiles.length === 0) {
      throw new GitError("No staged changes found");
    }

    // 3. 获取 diff
    let diff = this.gitService.getStagedDiff();
    const diffStat = this.gitService.getStagedDiffStat();

    // 4. 检查并截断 diff（如果需要）
    const maxInputTokens = this.config.AIGCM_MAX_TOKEN_INPUT ?? 8000;
    const promptOverhead = 1000; // 为 prompt 模板预留的 token
    const maxDiffTokens = maxInputTokens - promptOverhead;

    if (tokenCount(diff) > maxDiffTokens) {
      diff = truncateDiff(diff, maxDiffTokens);
    }

    // 5. 构建 Prompt
    const promptOptions = extractPromptOptions(this.config);
    const promptContext: PromptContext = {
      diff,
      stagedFiles,
      diffStat
    };

    const prompt =
      candidateCount > 1
        ? buildMultiplePrompt(promptContext, promptOptions)
        : buildPrompt(promptContext, promptOptions);

    // 6. 调用 LLM
    const provider = createProvider(this.config);
    const generateOptions: GenerateOptions = {
      maxInputTokens: this.config.AIGCM_MAX_TOKEN_INPUT,
      maxOutputTokens: this.config.AIGCM_MAX_TOKEN_OUTPUT
    };

    const llmResult = await provider.generate(prompt, generateOptions);

    // 7. 解析响应
    let candidates = parseCommitMessages(llmResult.content);

    // 如果解析失败，使用原始响应作为候选
    if (candidates.length === 0) {
      candidates = [llmResult.content.trim()];
    }

    // 限制候选数量
    candidates = candidates.slice(0, candidateCount);

    return {
      candidates,
      gitStatus,
      llmResult
    };
  }

  /**
   * 执行提交
   */
  executeCommit(message: string): CommitExecuteResult {
    if (!message.trim()) {
      return {
        success: false,
        message: "",
        error: "Commit message cannot be empty"
      };
    }

    try {
      this.gitService.commit(message);
      return {
        success: true,
        message
      };
    } catch (error) {
      return {
        success: false,
        message,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 获取 Git 状态
   */
  getGitStatus(): GitStatus {
    return this.gitService.getStatus();
  }

  /**
   * 获取暂存区 diff 预览
   */
  getDiffPreview(maxLines: number = 20): string {
    const diff = this.gitService.getStagedDiff();
    const lines = diff.split("\n");

    if (lines.length <= maxLines) {
      return diff;
    }

    return `${lines.slice(0, maxLines).join("\n")}\n... (${lines.length - maxLines} more lines)`;
  }
}

/**
 * 便捷函数：生成提交信息
 */
export async function generateCommitMessage(config: ConfigSchema, options?: CommitGenerateOptions): Promise<string[]> {
  const service = new CommitService(config, options?.cwd);
  const result = await service.generateCommitMessage(options);
  return result.candidates;
}

/**
 * 便捷函数：检查是否可以生成提交
 */
export function canGenerateCommit(config: ConfigSchema, cwd?: string): { valid: boolean; errors: string[] } {
  const service = new CommitService(config, cwd);
  return service.validatePrerequisites();
}
