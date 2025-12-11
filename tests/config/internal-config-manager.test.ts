import Conf from "conf";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InternalConfigManager } from "@/config/internal-config-manager";
import { INTERNAL_CONFIG_VERSION, type InternalConfigSchema } from "@/config/internal-config-schema";
import { getOrCreateClientId } from "@/utils/internal-config";

vi.mock("conf");

type ConfOptions = ConstructorParameters<typeof Conf>[0];

describe("InternalConfigManager", () => {
  const storage: Record<string, Record<string, unknown>> = {};

  const createMockConf = (options?: ConfOptions) => {
    const bucket = options?.configName ?? "config";
    const existing = storage[bucket];
    const data: Record<string, unknown> = existing ?? { ...(options?.defaults ?? {}) };
    storage[bucket] = data;

    return {
      get: vi.fn((k: string) => data[k]),
      set: vi.fn((k: string, v: unknown) => {
        data[k] = v;
      }),
      delete: vi.fn((k: string) => {
        delete data[k];
      }),
      has: vi.fn((k: string) => k in data),
      get store() {
        return data as InternalConfigSchema;
      }
    } as unknown as Conf<InternalConfigSchema>;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    Object.keys(storage).forEach((k) => {
      delete storage[k];
    });
    (Conf as unknown as { mockImplementation: (impl: (options?: ConfOptions) => unknown) => void }).mockImplementation(
      (options?: ConfOptions) => createMockConf(options)
    );
  });

  it("初始化时应写入默认的 schemaVersion", () => {
    const mgr = new InternalConfigManager();
    expect(mgr.get("schemaVersion").value).toBe(INTERNAL_CONFIG_VERSION);
    expect(mgr.get("schemaVersion").source).toBe("internal");
  });

  it("应支持基本的 set/get/delete 操作", () => {
    const mgr = new InternalConfigManager();
    mgr.set("lastVersionCheckAt", 123);
    expect(mgr.get("lastVersionCheckAt").value).toBe(123);
    expect(mgr.get("lastVersionCheckAt").source).toBe("internal");

    mgr.delete("lastVersionCheckAt");
    expect(mgr.get("lastVersionCheckAt").value).toBeUndefined();
  });

  it("getAll 应返回包含来源的完整映射", () => {
    const mgr = new InternalConfigManager();
    mgr.set("telemetryConsent", true);
    const all = mgr.getAll();

    expect(all.telemetryConsent.source).toBe("internal");
    expect(all.telemetryConsent.value).toBe(true);
    expect(all.clientId.value).toBeUndefined();
  });

  it("迁移逻辑应将旧版本提升到当前版本", () => {
    storage.internal = { schemaVersion: 0 };
    const mgr = new InternalConfigManager();
    expect(mgr.get("schemaVersion").value).toBe(INTERNAL_CONFIG_VERSION);
  });

  it("getOrCreateClientId 应懒生成并复用 clientId", () => {
    const mgr = new InternalConfigManager();

    const first = getOrCreateClientId(mgr);
    const second = getOrCreateClientId(mgr);

    expect(first).toBe(second);
    expect(typeof first).toBe("string");
    expect(first.length).toBeGreaterThan(0);
  });
});
