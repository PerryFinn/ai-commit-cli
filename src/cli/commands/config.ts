import { log } from "@clack/prompts";
import { Table } from "console-table-printer";
import pc from "picocolors";
import { ConfigManager } from "@/config/config-manager";
import { ConfigValidator, ValidationContext } from "@/config/config-validator";
import { DEFAULT_CONFIG } from "@/config/constants";
import { CONFIG_KEYS, type ConfigKey } from "@/types/config";
import { colorize } from "@/utils/color";

/**
 * 将 "KEY=value" 形式解析为键值
 */
const parseKeyValue = (pair: string): { key: ConfigKey; value: string } => {
  const idx = pair.indexOf("=");
  if (idx === -1) throw new Error(`无效的参数（缺少 '='）: ${pair}`);
  const key = pair.slice(0, idx).trim() as ConfigKey;
  const value = pair.slice(idx + 1).trim();
  return { key, value };
};

/**
 * config set 命令处理
 * @throws {Error} 参数错误或配置设置失败时抛出异常
 */
export const handleConfigSet = async (args: string[], cliEnv: Record<string, string | undefined>): Promise<void> => {
  if (args.length === 0) {
    throw new Error(`请提供至少一个配置项，例如: config set AIGCM_MODEL_ID=${DEFAULT_CONFIG.AIGCM_MODEL_ID}`);
  }
  const manager = new ConfigManager({ cliEnv: normalizeCliEnv(cliEnv) });
  for (const p of args) {
    const { key, value } = parseKeyValue(p);
    // 直接传递字符串给 ConfigManager，由其负责类型转换与校验
    manager.set(key, value);
    const result = manager.get(key);
    log.info(pc.green(`已设置 ${pc.bold(key)} = ${pc.bold(String(result.value))}`));
  }
};

/**
 * config get 命令处理
 * @throws {Error} 配置读取失败时抛出异常
 */
export const handleConfigGet = async (key: string, cliEnv: Record<string, string | undefined>): Promise<void> => {
  if (!CONFIG_KEYS.includes(key as ConfigKey)) {
    log.warn(pc.red(`不支持的key: ${key}`));
  }
  const manager = new ConfigManager({ cliEnv: normalizeCliEnv(cliEnv) });
  const { value, source } = manager.get(key as ConfigKey);
  if (typeof value === "undefined") {
    log.info(pc.yellow(`${pc.bold(key)} <unset>`));
  } else {
    log.info(`${pc.bold(key)} = ${colorize(value)} ${pc.dim(source ? `[${source}]` : "")}`);
  }
};

/**
 * config ls 命令处理
 */
export const handleConfigList = async (cliEnv: Record<string, string | undefined>): Promise<void> => {
  const manager = new ConfigManager({ cliEnv: normalizeCliEnv(cliEnv) });
  const all = manager.getAll();
  const rows = CONFIG_KEYS.map((key) => {
    const entry = all[key];
    const value = entry?.value;
    const source = entry?.source;
    return {
      key: pc.bold(key),
      value: typeof value === "undefined" ? pc.dim("<unset>") : colorize(value),
      source: pc.dim(source ?? "-"),
      // TODO: 添加描述
      desc: "-"
    };
  });
  const table = new Table({
    columns: [
      { name: "key", title: "KEY", alignment: "left" },
      { name: "value", title: "VALUE", alignment: "left", maxLen: 10 },
      { name: "source", title: "SOURCE", alignment: "left" },
      { name: "desc", title: "DESCRIPTION", alignment: "left" }
    ]
  });
  table.addRows(rows);
  log.info(table.render());
};

/**
 * config validate 命令处理
 * 验证当前配置是否满足 AI 提交生成的要求
 */
export const handleConfigValidate = async (cliEnv: Record<string, string | undefined>): Promise<boolean> => {
  const manager = new ConfigManager({ cliEnv: normalizeCliEnv(cliEnv) });
  const allConfig = manager.getAll();
  const config = ConfigValidator.extractValues(allConfig);

  const validator = new ConfigValidator();
  const result = validator.validate(config, ValidationContext.CommitGeneration);

  // 显示错误
  if (result.errors.length > 0) {
    log.error(pc.red(pc.bold("配置验证失败：")));
    for (const error of result.errors) {
      log.error(pc.red(`  ✗ [${error.field}] ${error.message}`));
      if (error.suggestion) {
        log.info(pc.dim(`    提示: ${error.suggestion}`));
      }
    }
  }

  // 显示警告
  if (result.warnings.length > 0) {
    log.warn(pc.yellow(pc.bold("配置建议：")));
    for (const warning of result.warnings) {
      log.warn(pc.yellow(`  ⚠ [${warning.field}] ${warning.message}`));
      if (warning.suggestion) {
        log.info(pc.dim(`    提示: ${warning.suggestion}`));
      }
    }
  }

  // 显示结果摘要
  if (!result.valid) {
    log.info(pc.dim("\n运行 'aigcm config ls' 查看当前配置"));
  }

  return result.valid;
};

/**
 * 规范化 CLI 环境变量，仅保留 AIGCM_ 前缀的变量
 */
const normalizeCliEnv = (env: Record<string, string | undefined>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (k.startsWith("AIGCM_") && typeof v === "string") {
      out[k] = v;
    }
  }
  return out;
};
