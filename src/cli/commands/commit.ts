/**
 * commit 命令处理
 * 负责协调 AI 生成提交信息的用户交互流程
 */

import { confirm, isCancel, log, select, spinner, text } from "@clack/prompts";
import pc from "picocolors";

import { ConfigManager } from "@/config/config-manager";
import { ConfigValidator, ValidationContext } from "@/config/config-validator";
import { CommitService } from "@/services/commit";
import { isValidConventionalCommit } from "@/services/prompt";
import type { ConfigSchema } from "@/types/config";
import { GitFileStatus, GitService, type StagedFile } from "@/utils/git";

/**
 * commit 命令选项
 */
export interface CommitOptions {
  /** 是否模拟运行（不实际提交） */
  dryRun?: boolean;
  /** 跳过确认步骤 */
  skipConfirm?: boolean;
  /** 自动暂存所有变更 */
  stageAll?: boolean;
}

/**
 * commit 命令处理函数
 */
export async function handleCommit(
  cliEnv: Record<string, string | undefined>,
  options: CommitOptions = {}
): Promise<number> {
  const { dryRun = false, skipConfirm = false, stageAll = false } = options;

  // 1. 初始化配置
  const manager = new ConfigManager({ cliEnv: normalizeCliEnv(cliEnv) });
  const allConfig = manager.getAll();
  const config = ConfigValidator.extractValues(allConfig) as ConfigSchema;

  // 2. 初始化 Git 服务
  const gitService = new GitService();

  // 3. 检查是否在 Git 仓库中
  if (!gitService.isInsideRepo()) {
    log.error(pc.red("当前目录不在 Git 仓库中"));
    return 1;
  }

  // 4. 如果指定了 --all，先暂存所有变更
  if (stageAll) {
    const s = spinner();
    s.start("暂存所有变更...");
    try {
      gitService.add();
      s.stop("已暂存所有变更");
    } catch (error) {
      s.stop("暂存失败");
      log.error(pc.red(error instanceof Error ? error.message : String(error)));
      return 1;
    }
  }

  // 5. 检查暂存区状态
  const status = gitService.getStatus();
  if (!status.hasStagedChanges) {
    log.warn(pc.yellow("没有暂存的变更。请使用 'git add' 暂存变更，或使用 --all 选项"));
    return 1;
  }

  // 6. 显示暂存文件列表
  displayStagedFiles(status.staged);

  // 7. 验证配置
  const validator = new ConfigValidator();
  const validationResult = validator.validate(config, ValidationContext.CommitGeneration);
  if (!validationResult.valid) {
    log.error(pc.red(pc.bold("配置验证失败：")));
    for (const error of validationResult.errors) {
      log.error(pc.red(`  ✗ [${error.field}] ${error.message}`));
      if (error.suggestion) {
        log.info(pc.dim(`    提示: ${error.suggestion}`));
      }
    }
    log.info(pc.dim("\n运行 'aigcm config validate' 查看详细配置状态"));
    return 1;
  }

  // 8. 生成提交信息
  const s = spinner();
  s.start("正在生成提交信息...");

  let candidates: string[];
  try {
    const commitService = new CommitService(config);
    const result = await commitService.generateCommitMessage({ candidateCount: 3 });
    candidates = result.candidates;
    s.stop("提交信息生成完成");
  } catch (error) {
    s.stop("生成失败");
    log.error(pc.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }

  if (candidates.length === 0) {
    log.error(pc.red("未能生成有效的提交信息"));
    return 1;
  }

  // 9. 让用户选择或编辑提交信息
  const selectedMessage = await selectCommitMessage(candidates);
  if (selectedMessage === null) {
    log.info(pc.dim("已取消操作"));
    return 0;
  }

  // 10. 模拟运行模式
  if (dryRun) {
    log.info(pc.cyan("\n[模拟运行] 将使用以下提交信息："));
    log.info(pc.bold(selectedMessage));
    return 0;
  }

  // 11. 确认提交
  if (!skipConfirm) {
    const shouldCommit = await confirm({
      message: "确认提交？",
      initialValue: true
    });

    if (isCancel(shouldCommit) || !shouldCommit) {
      log.info(pc.dim("已取消提交"));
      return 0;
    }
  }

  // 12. 执行提交
  const commitSpinner = spinner();
  commitSpinner.start("正在提交...");

  try {
    gitService.commit(selectedMessage);
    commitSpinner.stop(pc.green("提交成功！"));
    log.info(pc.dim(`提交信息: ${selectedMessage.split("\n")[0]}`));
    return 0;
  } catch (error) {
    commitSpinner.stop("提交失败");
    log.error(pc.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

/**
 * 显示暂存文件列表
 */
function displayStagedFiles(files: StagedFile[]): void {
  const statusLabels: Record<GitFileStatus, string> = {
    [GitFileStatus.Added]: pc.green("新增"),
    [GitFileStatus.Modified]: pc.yellow("修改"),
    [GitFileStatus.Deleted]: pc.red("删除"),
    [GitFileStatus.Renamed]: pc.blue("重命名"),
    [GitFileStatus.Copied]: pc.cyan("复制"),
    [GitFileStatus.Untracked]: pc.dim("未跟踪"),
    [GitFileStatus.Ignored]: pc.dim("忽略")
  };

  log.info(pc.bold(`暂存的变更 (${files.length} 个文件):`));
  let message = "";
  for (const file of files) {
    const label = statusLabels[file.status] ?? pc.dim(file.status);
    const path = file.oldPath ? `${file.oldPath} → ${file.path}` : file.path;
    message += `${label} ${path}\n`;
  }
  log.message(message);
}

/**
 * 让用户选择提交信息
 */
async function selectCommitMessage(candidates: string[]): Promise<string | null> {
  // 构建选项
  const options = candidates.map((msg, index) => ({
    value: msg,
    label: `${index + 1}. ${formatCommitPreview(msg)}`,
    hint: isValidConventionalCommit(msg) ? undefined : "非标准格式"
  }));

  // 添加自定义输入选项
  options.push({
    value: "__custom__",
    label: "✏️  自定义输入",
    hint: undefined
  });

  const selected = await select({
    message: "选择提交信息：",
    options
  });

  if (isCancel(selected)) {
    return null;
  }

  // 自定义输入
  if (selected === "__custom__") {
    const customMessage = await text({
      message: "请输入提交信息：",
      placeholder: "feat: your commit message",
      validate: (value) => {
        if (!value.trim()) {
          return "提交信息不能为空";
        }
        return undefined;
      }
    });

    if (isCancel(customMessage)) {
      return null;
    }

    return customMessage as string;
  }

  return selected as string;
}

/**
 * 格式化提交信息预览
 */
function formatCommitPreview(message: string, maxLength: number = 60): string {
  const firstLine = message.split("\n")[0] ?? "";
  if (firstLine.length <= maxLength) {
    return firstLine;
  }
  return `${firstLine.slice(0, maxLength - 3)}...`;
}

/**
 * 规范化 CLI 环境变量
 */
function normalizeCliEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (k.startsWith("AIGCM_") && typeof v === "string") {
      out[k] = v;
    }
  }
  return out;
}
