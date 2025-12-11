import { homedir } from "node:os";
import Conf from "conf";
import { join } from "pathe";
import {
  INTERNAL_CONFIG_DEFAULTS,
  INTERNAL_CONFIG_KEYS,
  INTERNAL_CONFIG_VERSION,
  type InternalConfigKey,
  type InternalConfigSchema,
  internalConfigProperties
} from "./internal-config-schema";

type InternalSourceTag = "internal";

export interface InternalValueWithSource<T> {
  value: T | undefined;
  source: InternalSourceTag | undefined;
}

export class InternalConfigManager {
  readonly #store: Conf<InternalConfigSchema>;

  constructor(params?: { projectDir?: string }) {
    const projectDir = params?.projectDir ?? join(homedir(), ".aigcm");

    this.#store = new Conf<InternalConfigSchema>({
      projectName: "ai-commit-cli",
      configName: "internal",
      cwd: projectDir,
      defaults: INTERNAL_CONFIG_DEFAULTS,
      schema: internalConfigProperties
    });

    this.migrateIfNeeded();
  }

  public get<K extends InternalConfigKey>(key: K): InternalValueWithSource<InternalConfigSchema[K]> {
    if (this.#store.has(key)) {
      return {
        value: this.#store.get(key) as InternalConfigSchema[K],
        source: "internal"
      };
    }
    return { value: undefined, source: undefined };
  }

  public set<K extends InternalConfigKey>(key: K, value: InternalConfigSchema[K]): void {
    this.assertValidKey(key);
    this.#store.set(key, value as never);
  }

  public delete<K extends InternalConfigKey>(key: K): void {
    this.assertValidKey(key);
    this.#store.delete(key);
  }

  public getAll(): Record<InternalConfigKey, InternalValueWithSource<string | number | boolean | undefined>> {
    const result = {} as Record<InternalConfigKey, InternalValueWithSource<string | number | boolean | undefined>>;
    for (const key of INTERNAL_CONFIG_KEYS) {
      if (this.#store.has(key)) {
        result[key] = { value: this.#store.get(key), source: "internal" };
      } else {
        result[key] = { value: undefined, source: undefined };
      }
    }
    return result;
  }

  private migrateIfNeeded(): void {
    const currentVersion = this.#store.get("schemaVersion") ?? INTERNAL_CONFIG_VERSION;
    const targetVersion = INTERNAL_CONFIG_VERSION;

    if (currentVersion === targetVersion) return;

    if (currentVersion < 1) {
      // 预留未来迁移逻辑
    }

    this.#store.set("schemaVersion", targetVersion as never);
  }

  private assertValidKey(key: string): asserts key is InternalConfigKey {
    if (!INTERNAL_CONFIG_KEYS.includes(key as InternalConfigKey)) {
      throw new Error(`Unsupported internal config key: ${key}`);
    }
  }
}
