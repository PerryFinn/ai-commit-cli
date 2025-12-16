import { log } from "@clack/prompts";
import Config from "@npmcli/config";
import Conf from "conf";
import npmRegistryFetch from "npm-registry-fetch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InternalConfigManager } from "@/config/internal-config-manager";
import { checkLatestVersion, VERSION_CHECK_INTERVAL_MS } from "@/utils/check-is-latest-version";
import pkgJson from "../../package.json";

let mockedFlatOptions: Record<string, unknown> = {};
let configLoadMock: ReturnType<typeof vi.fn>;

vi.mock("conf", () => {
  const ConfMock = vi.fn();
  return { default: ConfMock };
});

vi.mock("npm-registry-fetch", () => {
  const fetchFn = Object.assign(vi.fn(), { json: vi.fn(), pickRegistry: vi.fn() });
  return { default: fetchFn };
});

vi.mock("@npmcli/config/lib/definitions", () => ({
  definitions: {},
  flatten: vi.fn((src: Record<string, unknown>, dest: Record<string, unknown>) => Object.assign(dest, src)),
  shorthands: {}
}));

vi.mock("@npmcli/config", () => {
  const ConfigMock = vi.fn(() => ({
    load: configLoadMock,
    get flat() {
      return mockedFlatOptions;
    }
  }));
  return { default: ConfigMock };
});

vi.mock("@clack/prompts", () => ({
  log: {
    message: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
    warn: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  }
}));

type ConfOptions = ConstructorParameters<typeof Conf>[0];

describe("checkLatestVersion", () => {
  const defaultRegistry = "https://registry.npmjs.org/";
  const storage: Record<string, Record<string, unknown>> = {};
  const registryFetchMock = npmRegistryFetch as unknown as ReturnType<typeof vi.fn> & {
    json: ReturnType<typeof vi.fn>;
    pickRegistry: ReturnType<typeof vi.fn>;
  };
  const registryJsonMock = registryFetchMock.json;
  const pickRegistryMock = registryFetchMock.pickRegistry;
  const ConfigMock = Config as unknown as ReturnType<typeof vi.fn>;

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
      has: vi.fn((k: string) => k in data)
    } as unknown as Conf;
  };

  const mockNpmConfig = (config: Record<string, unknown>) => {
    mockedFlatOptions = config;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));

    vi.resetAllMocks();
    Object.keys(storage).forEach((k) => {
      delete storage[k];
    });

    registryJsonMock.mockReset();
    pickRegistryMock.mockReset();
    ConfigMock.mockClear();
    configLoadMock = vi.fn().mockResolvedValue(undefined);
    mockNpmConfig({ registry: defaultRegistry });

    pickRegistryMock.mockImplementation((_, opts?: Record<string, unknown>) => {
      const scopedRegistry = opts?.["@perryfinn:registry"];
      if (typeof scopedRegistry === "string") return scopedRegistry;
      const registry = opts?.registry;
      if (typeof registry === "string" && registry) return registry;
      return defaultRegistry;
    });

    (Conf as unknown as { mockImplementation: (impl: (options?: ConfOptions) => unknown) => void }).mockImplementation(
      (options?: ConfOptions) => createMockConf(options)
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("超过检查间隔时应执行检查并写入时间戳", async () => {
    registryJsonMock.mockResolvedValue({ "dist-tags": { latest: "9.9.9" } });

    await checkLatestVersion();

    expect(ConfigMock).toHaveBeenCalledTimes(1);
    expect(configLoadMock).toHaveBeenCalledTimes(1);
    expect(registryJsonMock).toHaveBeenCalledTimes(1);
    expect(registryJsonMock.mock.calls[0]?.[0]).toBe(pkgJson.name);
    expect(registryJsonMock.mock.calls[0]?.[1]).toMatchObject({ registry: defaultRegistry });
    expect(pickRegistryMock).toHaveBeenCalledWith(pkgJson.name, expect.objectContaining({ registry: defaultRegistry }));
    expect(log.info).toHaveBeenCalledTimes(1);

    const mgr = new InternalConfigManager();
    expect(mgr.get("lastVersionCheckAt").value).toBe(Date.now());
  });

  it("间隔内应跳过检查且不更新时间戳", async () => {
    const mgr = new InternalConfigManager();
    const recent = Date.now() - VERSION_CHECK_INTERVAL_MS / 2;
    mgr.set("lastVersionCheckAt", recent);

    await checkLatestVersion();

    expect(registryJsonMock).not.toHaveBeenCalled();
    expect(ConfigMock).not.toHaveBeenCalled();
    expect(mgr.get("lastVersionCheckAt").value).toBe(recent);
    expect(log.info).not.toHaveBeenCalled();
  });

  it("获取失败时也应写入最新检查时间", async () => {
    registryJsonMock.mockRejectedValue(new Error("network down"));

    await checkLatestVersion();

    expect(registryJsonMock).toHaveBeenCalledTimes(1);
    expect(ConfigMock).toHaveBeenCalledTimes(1);
    expect(configLoadMock).toHaveBeenCalledTimes(1);

    const mgr = new InternalConfigManager();
    expect(mgr.get("lastVersionCheckAt").value).toBe(Date.now());
  });

  it("应使用 scope 对应的 registry", async () => {
    const scopedRegistry = "https://registry.example.com/";
    mockNpmConfig({ registry: defaultRegistry, "@perryfinn:registry": scopedRegistry });
    registryJsonMock.mockResolvedValue({ "dist-tags": { latest: "9.9.9" } });

    await checkLatestVersion();

    expect(pickRegistryMock).toHaveBeenCalledWith(
      pkgJson.name,
      expect.objectContaining({ "@perryfinn:registry": scopedRegistry })
    );
    expect(registryJsonMock.mock.calls[0]?.[1]).toMatchObject({ registry: scopedRegistry });
  });
});
