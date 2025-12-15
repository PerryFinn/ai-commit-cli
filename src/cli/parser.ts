import { intro, log, outro } from "@clack/prompts";
import mri from "mri";
import pc from "picocolors";
import { name as packageName, version as packageVersion } from "../../package.json";
import { type CommitOptions, handleCommit } from "./commands/commit";
import { handleConfigGet, handleConfigList, handleConfigSet, handleConfigValidate } from "./commands/config";
import { handleError } from "./error-handler";

export type CLIResult = number;

/**
 * 解析 CLI 参数并分发到对应的子命令
 * 支持：
 * - aigcm                          默认执行 commit（生成 AI 提交信息）
 * - aigcm commit [options]         生成 AI 提交信息
 * - aigcm config set KEY=value     设置配置项
 * - aigcm config get KEY           查询配置项
 * - aigcm config ls                列出所有配置
 * - aigcm config validate          验证配置完整性
 */
export async function runCLI(argvInput: string[] = process.argv.slice(2)): Promise<CLIResult> {
  showIntro();
  try {
    const argv = mri(argvInput, {
      alias: {
        h: "help",
        a: "all",
        y: "yes",
        d: "dry-run",
        v: "version"
      },
      boolean: ["help", "all", "yes", "dry-run", "version"],
      default: {}
    });

    const [command, subcommand, ...rest] = argv._ as string[];

    if (argv.version) {
      log.info(`${pc.bold(packageName)} v${packageVersion}`);
      return 0;
    }

    if (argv.help && !command) {
      printHelp();
      return 0;
    }

    // 无命令或 commit 命令 → 执行 AI 提交信息生成
    if (!command || command === "commit") {
      if (argv.help) {
        printCommitHelp();
        return 0;
      }
      const options: CommitOptions = {
        dryRun: argv["dry-run"] as boolean,
        skipConfirm: argv.yes as boolean,
        stageAll: argv.all as boolean
      };
      return await handleCommitCommand(options);
    }

    if (command === "config") {
      if (argv.help) {
        printConfigHelp();
        return 0;
      }
      return await handleConfig(subcommand, rest);
    }

    log.error(pc.red(`未知命令：${command}`));
    printHelp();
    return 1;
  } finally {
    showOutro();
  }
}

async function handleCommitCommand(options: CommitOptions): Promise<CLIResult> {
  const processEnv = process.env as Record<string, string | undefined>;
  try {
    return await handleCommit(processEnv, options);
  } catch (error) {
    handleError(error);
    return 1;
  }
}

async function handleConfig(subcommand: string | undefined, args: string[]): Promise<CLIResult> {
  const processEnv = process.env as Record<string, string | undefined>;
  try {
    switch (subcommand) {
      case "set": {
        await handleConfigSet(args, processEnv);
        return 0;
      }
      case "get": {
        const [key] = args;
        if (!key) {
          log.error(pc.red("请提供要查询的 key，例如: config get AIGCM_MODEL_ID"));
          return 1;
        }
        await handleConfigGet(key, processEnv);
        return 0;
      }
      case "ls":
      case "list": {
        await handleConfigList(processEnv);
        return 0;
      }
      case "validate": {
        const valid = await handleConfigValidate(processEnv);
        return valid ? 0 : 1;
      }
      default: {
        log.error(pc.red(`未知子命令：${subcommand ?? "<empty>"}`));
        printConfigHelp();
        return 1;
      }
    }
  } catch (error) {
    handleError(error);
    return 1;
  }
}

function printHelp(): void {
  const lines = [
    `${pc.bold("用法:")} aigcm [command] [options]`,
    "",
    `${pc.bold("命令:")}`,
    "  (default)      生成 AI 提交信息（等同于 commit）",
    "  commit         生成 AI 提交信息",
    "  config         管理配置（set/get/ls/validate）",
    "",
    `${pc.bold("全局选项:")}`,
    "  -h, --help     显示帮助信息",
    "  -v, --version  显示当前版本",
    "",
    `${pc.bold("Commit 选项:")}`,
    "  -a, --all      暂存所有变更后提交",
    "  -y, --yes      跳过确认步骤",
    "  -d, --dry-run  模拟运行（不实际提交）",
    "",
    `${pc.bold("示例:")}`,
    "  aigcm                            # 生成提交信息",
    "  aigcm -a                         # 暂存所有变更并生成提交信息",
    "  aigcm --dry-run                  # 模拟运行",
    "  aigcm config set AIGCM_MODEL_ID=gpt-4o",
    "  aigcm config ls"
  ];
  log.info(`${lines.join("\n")}\n`);
}

function printCommitHelp(): void {
  const lines = [
    `${pc.bold("用法:")} aigcm [commit] [options]`,
    "",
    `${pc.bold("描述:")}`,
    "  使用 AI 根据暂存区的变更生成 Conventional Commit 格式的提交信息",
    "",
    `${pc.bold("选项:")}`,
    "  -a, --all      暂存所有变更后提交",
    "  -y, --yes      跳过确认步骤",
    "  -d, --dry-run  模拟运行（不实际提交）",
    "  -h, --help     显示帮助信息",
    "",
    `${pc.bold("工作流程:")}`,
    "  1. 检查 Git 仓库状态和暂存区",
    "  2. 验证配置（API Key、Provider 等）",
    "  3. 调用 LLM 生成候选提交信息",
    "  4. 用户选择或编辑提交信息",
    "  5. 确认并执行提交",
    "",
    `${pc.bold("示例:")}`,
    "  aigcm                  # 基于暂存区生成提交信息",
    "  aigcm -a               # 暂存所有变更后生成提交信息",
    "  aigcm -ay              # 暂存并跳过确认",
    "  aigcm --dry-run        # 仅生成不提交"
  ];
  log.info(`\n${lines.join("\n")}\n`);
}

function printConfigHelp(): void {
  const lines = [
    `${pc.bold("用法:")} aigcm config <subcommand>`,
    "",
    `${pc.bold("子命令:")}`,
    "  set KEY=value [... ]     设置配置项",
    "  get KEY                  查询配置项",
    "  ls                       列出所有配置",
    "  validate                 验证配置完整性",
    ""
  ];
  log.info(`\n${lines.join("\n")}\n`);
}

function showIntro(): void {
  intro(pc.inverse(packageName));
}

function showOutro(): void {
  outro(pc.inverse(packageName));
}
