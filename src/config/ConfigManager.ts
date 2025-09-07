import { homedir } from "node:os";
import Conf from "conf";
import { CONFIG_KEYS, type ConfigKey, type ConfigSchema, configProperties } from "@/types/config";
import { type EnvMap, findEnvFile, loadEnvFile } from "@/utils/env";

type SourceTag = "cli" | ".env" | "config";

/**
 * 值与来源封装
 */
export interface ValueWithSource<T> {
  value: T | undefined;
  source: SourceTag | undefined;
}

/**
 * ConfigManager：核心配置管理
 * - 使用 conf 做持久化与 schema 校验
 * - 三层优先级：命令行传入的 env > 本地 .env > 配置文件存储
 */
export class ConfigManager {
  private readonly store: Conf<ConfigSchema>;
  private readonly cliEnv: EnvMap;
  private readonly dotEnv: EnvMap;

  constructor(params?: { cliEnv?: EnvMap; projectDir?: string }) {
    // 从 CLI 注入的环境变量（最高优先级）
    this.cliEnv = params?.cliEnv ?? {};

    // 解析 .env（中等优先级）
    const envFile = findEnvFile(params?.projectDir ?? process.cwd());
    this.dotEnv = envFile ? loadEnvFile(envFile) : {};

    // conf 持久化（最低优先级）
    this.store = new Conf<ConfigSchema>({
      projectName: "ai-commit-cli",
      // conf 期望的是一个“属性映射”的 schema，而非完整 JSON Schema，因此仅传入 properties 部分
      schema: configProperties,
      cwd: homedir()
    });
  }

  /**
   * 读取某个键的值，并给出来源
   */
  public get<K extends ConfigKey>(key: K): ValueWithSource<ConfigSchema[K]> {
    // 优先级：cliEnv -> dotEnv -> config store
    if (key in this.cliEnv) {
      return { value: this.castValue(key, this.cliEnv[key] as string), source: "cli" };
    }
    if (key in this.dotEnv) {
      return { value: this.castValue(key, this.dotEnv[key] as string), source: ".env" };
    }
    return { value: this.store.get(key) as ConfigSchema[K], source: this.store.has(key) ? "config" : undefined };
  }

  /**
   * 设置某个键的值（直接持久化到 config，注意：不会写入 .env）
   */
  public set<K extends ConfigKey>(key: K, value: ConfigSchema[K]): void {
    this.assertValidKey(key);
    this.assertValidValue(key, value);
    this.store.set(key, value as unknown as never);
  }

  /**
   * 是否存在某个键（任一来源）
   */
  public has<K extends ConfigKey>(key: K): boolean {
    if (key in this.cliEnv) return true;
    if (key in this.dotEnv) return true;
    return this.store.has(key);
  }

  /**
   * 获取合并后的所有配置（已按优先级覆盖）以及来源
   */
  public getAll(): Record<ConfigKey, ValueWithSource<unknown>> {
    const result: Record<ConfigKey, ValueWithSource<unknown>> = {} as Record<ConfigKey, ValueWithSource<unknown>>;
    for (const key of CONFIG_KEYS) {
      if (key in this.cliEnv) {
        result[key] = { value: this.castValue(key, this.cliEnv[key] as string), source: "cli" };
        continue;
      }
      if (key in this.dotEnv) {
        result[key] = { value: this.castValue(key, this.dotEnv[key] as string), source: ".env" };
        continue;
      }
      if (this.store.has(key)) {
        result[key] = { value: this.store.get(key), source: "config" };
      } else {
        result[key] = { value: undefined, source: undefined };
      }
    }
    return result;
  }

  /**
   * 校验 key 是否受支持
   */
  private assertValidKey(key: string): asserts key is ConfigKey {
    if (!CONFIG_KEYS.includes(key as ConfigKey)) {
      throw new Error(`不支持的配置键：${key}`);
    }
  }

  /**
   * 依据 JSON Schema 做基本的类型校验
   */
  private assertValidValue<K extends ConfigKey>(key: K, value: unknown): asserts value is ConfigSchema[K] {
    const prop = configProperties[key];
    if (!prop) return;
    const type = prop.type;
    if (type === "boolean" && typeof value !== "boolean") throw new Error(`配置 ${key} 需要 boolean 类型`);
    if (type === "number" && typeof value !== "number") throw new Error(`配置 ${key} 需要 number 类型`);
    if (type === "string" && typeof value !== "string") throw new Error(`配置 ${key} 需要 string 类型`);
    if (prop.enum && !prop.enum.includes(value)) throw new Error(`配置 ${key} 仅允许：${prop.enum.join(", ")}`);
    if (typeof prop.minimum === "number" && typeof value === "number" && value < prop.minimum) {
      throw new Error(`配置 ${key} 不能小于 ${prop.minimum}`);
    }
  }

  /**
   * 将字符串值根据 schema 推断转换为目标类型
   * 说明：仅对来自 env 的值做转换；config store 中的数据维持原样
   */
  private castValue<K extends ConfigKey>(key: K, raw: string): ConfigSchema[K] {
    const prop = configProperties[key];
    if (!prop) return raw as unknown as ConfigSchema[K];
    switch (prop.type) {
      case "boolean":
        return (raw === "true" || raw === "1") as unknown as ConfigSchema[K];
      case "number": {
        const n = Number(raw);
        if (Number.isNaN(n)) return undefined as unknown as ConfigSchema[K];
        return n as unknown as ConfigSchema[K];
      }
      case "string":
      default:
        return raw as unknown as ConfigSchema[K];
    }
  }
}
