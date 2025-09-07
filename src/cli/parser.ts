import { intro, log, outro } from "@clack/prompts";
import mri from "mri";
import pc from "picocolors";
import { name as packageName } from "../../package.json";
import { handleConfigGet, handleConfigList, handleConfigSet } from "./commands/config";

export type CLIResult = number;

/**
 * 解析 CLI 参数并分发到对应的子命令
 * 支持：
 * - aigcm config set KEY=value [...]
 * - aigcm config get KEY
 * - aigcm config ls
 */
export async function runCLI(argvInput: string[] = process.argv.slice(2)): Promise<CLIResult> {
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
}

async function handleConfig(subcommand: string | undefined, args: string[]): Promise<CLIResult> {
  await bootstrapIntro();
  const processEnv = process.env as Record<string, string | undefined>;
  try {
    switch (subcommand) {
      case "set": {
        await handleConfigSet(args, processEnv);
        await outroOk();
        return 0;
      }
      case "get": {
        const [key] = args;
        if (!key) {
          log.error(pc.red("请提供要查询的 key，例如: config get AIGCM_MODEL_ID"));
          await outroOk();
          return 1;
        }
        await handleConfigGet(key, processEnv);
        await outroOk();
        return 0;
      }
      case "ls":
      case "list": {
        await handleConfigList(processEnv);
        await outroOk();
        return 0;
      }
      default: {
        log.error(pc.red(`未知子命令：${subcommand ?? "<empty>"}`));
        printConfigHelp();
        await outroOk();
        return 1;
      }
    }
  } catch (error) {
    log.error(pc.red((error as Error).message));
    await outroOk();
    return 1;
  }
}

function printHelp(): void {
  const lines = [
    `${pc.bold("用法:")} aigcm <command> [options]`,
    "",
    `${pc.bold("命令:")}`,
    "  config         管理配置（set/get/ls）",
    "",
    `${pc.bold("示例:")}`,
    "  aigcm config set AIGCM_MODEL_ID=gpt-4o",
    "  aigcm config get AIGCM_MODEL_ID",
    "  aigcm config ls"
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
    ""
  ];
  log.info("\n" + lines.join("\n") + "\n");
}

async function bootstrapIntro(): Promise<void> {
  intro(pc.inverse(packageName));
}

async function outroOk(): Promise<void> {
  outro(pc.inverse(packageName));
}
