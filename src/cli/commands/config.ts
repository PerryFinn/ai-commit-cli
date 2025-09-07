import { log } from "@clack/prompts";
import pc from "picocolors";
import { ConfigManager } from "../../config/ConfigManager";
import { CONFIG_KEYS, type ConfigKey, configJsonSchema } from "../../types/config";

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
 */
export const handleConfigSet = async (args: string[], cliEnv: Record<string, string | undefined>): Promise<void> => {
  try {
    if (args.length === 0) {
      log.error(pc.red("请提供至少一个配置项，例如: config set AIGCM_MODEL_ID=gpt-4o"));
      return;
    }
    const manager = new ConfigManager({ cliEnv: normalizeCliEnv(cliEnv) });
    for (const p of args) {
      const { key, value } = parseKeyValue(p);
      const casted = coerceValueForKey(key, value) as string | number | boolean | undefined;
      manager.set(key, casted);
      log.info(pc.green(`已设置 ${pc.bold(key)} = ${pc.bold(String(casted))}`));
    }
  } catch (error) {
    log.error(pc.red((error as Error).message));
  }
};

/**
 * config get 命令处理
 */
export const handleConfigGet = async (key: string, cliEnv: Record<string, string | undefined>): Promise<void> => {
  try {
    if (!CONFIG_KEYS.includes(key as ConfigKey)) {
      log.warn(pc.red(`不支持的key: ${key}`));
    }
    const manager = new ConfigManager({ cliEnv: normalizeCliEnv(cliEnv) });
    const { value, source } = manager.get(key as ConfigKey);
    if (typeof value === "undefined") {
      log.info(pc.yellow(`${pc.bold(key)} 未设置`));
    } else {
      log.info(`${pc.bold(key)} = ${pc.cyan(String(value))} ${pc.dim(source ? `[${source}]` : "")}`);
    }
  } catch (error) {
    log.error(pc.red((error as Error).message));
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
    return [
      pc.bold(key),
      typeof value === "undefined" ? pc.dim("<unset>") : pc.cyan(String(value)),
      pc.dim(source ?? "-")
    ];
  });
  // 简单表格输出
  const header = [pc.bold("KEY"), pc.bold("VALUE"), pc.bold("SOURCE")];
  const widths = [28, 32, 10] as const;
  const lines = [header, ...rows].map((cols) => cols.map((c, i) => padRight(c, widths[i] ?? 20)).join(" ")).join("\n");
  log.info(`\n${lines}\n`);
};

const padRight = (text: string, len: number): string => text + (text.length < len ? " ".repeat(len - text.length) : "");

const normalizeCliEnv = (env: Record<string, string | undefined>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
};

/**
 * 根据 JSON Schema 对字符串做类型转化与校验
 */
const coerceValueForKey = (key: ConfigKey, raw: string): unknown => {
  type JsonSchemaProp = {
    type: "string" | "number" | "boolean";
    enum?: readonly unknown[];
    minimum?: number;
  };
  const prop = (configJsonSchema as { properties: Record<string, JsonSchemaProp> }).properties[key];
  if (!prop) return raw;
  if (prop.type === "boolean") {
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
    throw new Error(`配置 ${key} 需要 boolean 类型`);
  }
  if (prop.type === "number") {
    const n = Number(raw);
    if (Number.isNaN(n)) throw new Error(`配置 ${key} 需要 number 类型`);
    if (typeof prop.minimum === "number" && n < prop.minimum) throw new Error(`配置 ${key} 不能小于 ${prop.minimum}`);
    return n;
  }
  if (prop.enum && !prop.enum.includes(raw)) throw new Error(`配置 ${key} 仅允许：${prop.enum.join(", ")}`);
  return raw;
};
