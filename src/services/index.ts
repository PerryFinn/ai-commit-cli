/**
 * 服务层统一导出
 */

// 提交信息生成服务
export {
  type CommitExecuteResult,
  type CommitGenerateOptions,
  type CommitGenerateResult,
  CommitService,
  canGenerateCommit,
  generateCommitMessage
} from "./commit";

// Prompt 构建
export {
  buildMultiplePrompt,
  buildPrompt,
  estimateTokenCount,
  extractPromptOptions,
  isValidConventionalCommit,
  type PromptContext,
  type PromptOptions,
  parseCommitMessages,
  truncateDiff
} from "./prompt";

// Provider
export {
  BaseProvider,
  createDifyProvider,
  createGeminiProvider,
  createOpenAIProvider,
  createProvider,
  DifyProvider,
  GeminiProvider,
  type GenerateOptions,
  type GenerateResult,
  getSupportedProviders,
  isProviderSupported,
  type LLMProvider,
  OpenAIProvider,
  type ProviderConfig
} from "./providers";
