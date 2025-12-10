/**
 * Prompt 构建模块
 * 负责根据配置和 Git diff 构建发送给 LLM 的提示词
 */

import conventionalConfig from "@commitlint/config-conventional";
import lint from "@commitlint/lint";
import type { LintOptions } from "@commitlint/types";
// @ts-expect-error - No declaration file found
import createConventionalPreset from "conventional-changelog-conventionalcommits";

import type { ConfigSchema, Language } from "@/types/config";
import type { StagedFile } from "@/utils/git";

/**
 * Prompt 构建上下文
 */
export interface PromptContext {
  /** 暂存区 diff 内容 */
  diff: string;
  /** 暂存区文件列表 */
  stagedFiles: StagedFile[];
  /** diff 统计信息 */
  diffStat?: string;
}

/**
 * Prompt 配置选项
 */
export interface PromptOptions {
  /** 语言：zh_CN | en */
  language: Language;
  /** 是否生成单行提交信息 */
  oneLine: boolean;
  /** 是否省略 scope */
  omitScope: boolean;
  /** 自定义 prompt 模块（可选） */
  customModule?: string;
}

/**
 * 语言相关的提示词模板
 */
const LANGUAGE_TEMPLATES = {
  zh_CN: {
    systemRole: "你是一个专业的 Git 提交信息生成助手。你需要根据代码变更生成符合 Conventional Commits 规范的提交信息。",
    generateTask: "请根据以下代码变更生成提交信息：",
    conventionalFormat: `
提交信息必须遵循 Conventional Commits 规范：
- 格式：<type>(<scope>): <description>
- type 必须是以下之一：feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- scope 是可选的，表示影响的模块或范围
- description 是简短的变更描述，使用祈使句，首字母小写，不以句号结尾`,
    oneLineHint: "只生成一行提交信息，不需要详细的正文说明。",
    multiLineHint: `生成完整的提交信息，包括：
- 第一行：简短的标题（不超过 72 个字符）
- 空行
- 详细的正文说明（每行不超过 100 个字符）`,
    omitScopeHint: "不要包含 scope，只使用 <type>: <description> 格式。",
    outputFormat: "直接输出提交信息，不要添加额外的解释或代码块标记。",
    filesChanged: "变更的文件：",
    diffContent: "Diff 内容：",
    generateMultiple: "请生成 3 条候选提交信息，每条用空行分隔，供用户选择。"
  },
  en: {
    systemRole:
      "You are a professional Git commit message generator. Generate commit messages following the Conventional Commits specification based on code changes.",
    generateTask: "Generate a commit message based on the following code changes:",
    conventionalFormat: `
The commit message must follow the Conventional Commits specification:
- Format: <type>(<scope>): <description>
- type must be one of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- scope is optional, indicating the affected module or area
- description is a brief change summary in imperative mood, lowercase, no period at the end`,
    oneLineHint: "Generate a single-line commit message without detailed body.",
    multiLineHint: `Generate a complete commit message including:
- First line: short title (max 72 characters)
- Blank line
- Detailed body (each line max 100 characters)`,
    omitScopeHint: "Do not include scope, use <type>: <description> format only.",
    outputFormat: "Output the commit message directly without additional explanations or code block markers.",
    filesChanged: "Changed files:",
    diffContent: "Diff content:",
    generateMultiple: "Generate 3 candidate commit messages, separated by blank lines, for user selection."
  }
} as const;

/**
 * 从配置中提取 Prompt 选项
 */
export function extractPromptOptions(config: Partial<ConfigSchema>): PromptOptions {
  return {
    language: config.AIGCM_LANGUAGE ?? "en",
    oneLine: config.AIGCM_ONE_LINE_COMMIT ?? false,
    omitScope: config.AIGCM_OMIT_COMMIT_SCOPE ?? false,
    customModule: config.AIGCM_PROMPT_MODULE
  };
}

/**
 * 格式化暂存文件列表
 */
function formatStagedFiles(files: StagedFile[]): string {
  return files
    .map((f) => {
      const status = {
        A: "[Added]",
        M: "[Modified]",
        D: "[Deleted]",
        R: "[Renamed]",
        C: "[Copied]",
        "?": "[Untracked]",
        "!": "[Ignored]"
      }[f.status];
      return f.oldPath ? `${status} ${f.oldPath} -> ${f.path}` : `${status} ${f.path}`;
    })
    .join("\n");
}

/**
 * 构建 Prompt
 * @param context Prompt 上下文（diff 内容、暂存文件等）
 * @param options Prompt 选项
 * @returns 构建好的 prompt 字符串
 */
export function buildPrompt(context: PromptContext, options: PromptOptions): string {
  const template = LANGUAGE_TEMPLATES[options.language];
  const parts: string[] = [];

  // 1. 系统角色设定
  parts.push(template.systemRole);
  parts.push("");

  // 2. 任务描述
  parts.push(template.generateTask);
  parts.push("");

  // 3. Conventional Commits 规范说明
  parts.push(template.conventionalFormat);
  parts.push("");

  // 4. 格式提示（单行/多行）
  if (options.oneLine) {
    parts.push(template.oneLineHint);
  } else {
    parts.push(template.multiLineHint);
  }
  parts.push("");

  // 5. Scope 提示
  if (options.omitScope) {
    parts.push(template.omitScopeHint);
    parts.push("");
  }

  // 6. 自定义模块
  if (options.customModule) {
    parts.push(`Additional instructions: ${options.customModule}`);
    parts.push("");
  }

  // 7. 变更文件列表
  if (context.stagedFiles.length > 0) {
    parts.push(template.filesChanged);
    parts.push(formatStagedFiles(context.stagedFiles));
    parts.push("");
  }

  // 8. Diff 统计信息
  if (context.diffStat) {
    parts.push("Statistics:");
    parts.push(context.diffStat);
    parts.push("");
  }

  // 9. Diff 内容
  parts.push(template.diffContent);
  parts.push("```diff");
  parts.push(context.diff);
  parts.push("```");
  parts.push("");

  // 10. 输出格式要求
  parts.push(template.outputFormat);

  return parts.join("\n");
}

/**
 * 构建用于生成多条候选消息的 Prompt
 */
export function buildMultiplePrompt(context: PromptContext, options: PromptOptions): string {
  const basePrompt = buildPrompt(context, options);
  const template = LANGUAGE_TEMPLATES[options.language];
  return `${basePrompt}\n\n${template.generateMultiple}`;
}

/**
 * 解析 LLM 响应，提取提交信息候选列表
 * @param response LLM 响应内容
 * @returns 提交信息候选列表
 */
export function parseCommitMessages(response: string): string[] {
  // 清理响应内容
  let cleaned = response.trim();

  // 移除可能的代码块标记
  cleaned = cleaned.replace(/^```[\w]*\n?/gm, "").replace(/\n?```$/gm, "");

  // 按多个空行分割（处理多条候选）
  const candidates = cleaned
    .split(/\n{2,}/)
    .map((msg) => msg.trim())
    .filter((msg) => {
      // 过滤空消息和明显不是提交信息的内容
      if (!msg) return false;
      // 检查是否以 conventional commit type 开头
      const conventionalPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?:/i;
      return conventionalPattern.test(msg);
    });

  // 如果没有匹配的候选，尝试更宽松的解析
  if (candidates.length === 0) {
    const lines = cleaned.split("\n").filter((l) => l.trim());
    const firstLine = lines[0];
    if (firstLine) {
      // 返回第一行作为唯一候选
      return [firstLine];
    }
  }

  return candidates;
}

const parserOptsPromise: Promise<LintOptions["parserOpts"]> = (async () => {
  try {
    const preset = await createConventionalPreset();
    return (preset as { parserOpts?: LintOptions["parserOpts"] }).parserOpts;
  } catch {
    return undefined;
  }
})();

const lintOptionsPromise: Promise<LintOptions> = (async () => ({
  parserOpts: await parserOptsPromise,
  defaultIgnores: false
}))();

async function getLintOptions(): Promise<LintOptions> {
  return lintOptionsPromise;
}

/**
 * 验证提交信息是否符合 Conventional Commits 规范
 */
export async function isValidConventionalCommit(message: string): Promise<boolean> {
  const firstLine = message.split("\n")[0]?.trim() ?? "";
  if (!firstLine) {
    return false;
  }

  try {
    const lintOptions = await getLintOptions();
    const result = await lint(firstLine, conventionalConfig.rules ?? {}, lintOptions);
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * 估算 prompt 的 token 数量（粗略估计）
 * 用于在发送前检查是否超出限制
 */
export function estimateTokenCount(text: string): number {
  // 粗略估算：英文约 4 字符 = 1 token，中文约 1.5 字符 = 1 token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * 截断 diff 内容以适应 token 限制
 */
export function truncateDiff(diff: string, maxTokens: number): string {
  const currentTokens = estimateTokenCount(diff);
  if (currentTokens <= maxTokens) {
    return diff;
  }

  // 按文件分割 diff
  const fileDiffs = diff.split(/(?=diff --git)/);

  // 优先保留前面的文件，截断后面的
  const result: string[] = [];
  let usedTokens = 0;
  const reserveTokens = 100; // 为截断提示预留

  for (const fileDiff of fileDiffs) {
    const tokens = estimateTokenCount(fileDiff);
    if (usedTokens + tokens <= maxTokens - reserveTokens) {
      result.push(fileDiff);
      usedTokens += tokens;
    } else {
      break;
    }
  }

  if (result.length < fileDiffs.length) {
    result.push("\n... [remaining diff truncated due to token limit]");
  }

  return result.join("");
}
