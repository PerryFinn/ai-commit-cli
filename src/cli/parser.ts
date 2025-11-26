import { intro, log, outro } from "@clack/prompts";
import mri from "mri";
import pc from "picocolors";
import { name as packageName } from "../../package.json";
import { handleConfigGet, handleConfigList, handleConfigSet, handleConfigValidate } from "./commands/config";
import { handleError } from "./error-handler";

export type CLIResult = number;

/**
 * 解析 CLI 参数并分发到对应的子命令
 * 支持：
 * - aigcm config set KEY=value [...]
 * - aigcm config get KEY
 * - aigcm config ls
 */
export async function runCLI(argvInput: string[] = process.argv.slice(2)): Promise<CLIResult> {
  showIntro();
  try {
    const argv = mri(argvInput, {
      alias: { h: "help" },
      boolean: ["help"],
      default: {}
    });

    const [command, subcommand, ...rest] = argv._ as string[];

    if (argv.help || !command) {
      printHelp();
      return 0;
    }

    if (command === "config") {
      return await handleConfig(subcommand, rest);
    }

    // 预留：未来主命令（生成 AI 提交信息）
    log.error(pc.red(`未知命令：${command}`));
    printHelp();
    return 1;
  } finally {
    showOutro();
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
    `${pc.bold("用法:")} aigcm <command> [options]`,
    "",
    `${pc.bold("命令:")}`,
    "  config         管理配置（set/get/ls/validate）",
    "",
    `${pc.bold("示例:")}`,
    "  aigcm config set AIGCM_MODEL_ID=gpt-4o",
    "  aigcm config get AIGCM_MODEL_ID",
    "  aigcm config ls",
    "  aigcm config validate"
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
