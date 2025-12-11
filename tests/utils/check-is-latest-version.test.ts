import { log } from "@clack/prompts";
import Conf from "conf";
import { execa } from "execa";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InternalConfigManager } from "@/config/internal-config-manager";
import { checkLatestVersion, VERSION_CHECK_INTERVAL_MS } from "@/utils/check-is-latest-version";

vi.mock("conf", () => {
  const ConfMock = vi.fn();
  return { default: ConfMock };
});

vi.mock("execa", () => ({
  execa: vi.fn()
}));

vi.mock("@clack/prompts", () => ({
  log: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

type ConfOptions = ConstructorParameters<typeof Conf>[0];
type MockExeca = ReturnType<typeof vi.fn>;

describe("checkLatestVersion", () => {
  const storage: Record<string, Record<string, unknown>> = {};
  const execaMock = execa as unknown as MockExeca;

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

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));

    vi.resetAllMocks();
    Object.keys(storage).forEach((k) => {
      delete storage[k];
    });

    (Conf as unknown as { mockImplementation: (impl: (options?: ConfOptions) => unknown) => void }).mockImplementation(
      (options?: ConfOptions) => createMockConf(options)
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("超过检查间隔时应执行检查并写入时间戳", async () => {
    execaMock.mockResolvedValue({ stdout: "9.9.9" } as unknown as Awaited<ReturnType<typeof execa>>);

    await checkLatestVersion();

    expect(execaMock).toHaveBeenCalledWith("npm", expect.arrayContaining(["view"]));
    expect(log.info).toHaveBeenCalledTimes(1);

    const mgr = new InternalConfigManager();
    expect(mgr.get("lastVersionCheckAt").value).toBe(Date.now());
  });

  it("间隔内应跳过检查且不更新时间戳", async () => {
    const mgr = new InternalConfigManager();
    const recent = Date.now() - VERSION_CHECK_INTERVAL_MS / 2;
    mgr.set("lastVersionCheckAt", recent);

    await checkLatestVersion();

    expect(execaMock).not.toHaveBeenCalled();
    expect(mgr.get("lastVersionCheckAt").value).toBe(recent);
    expect(log.info).not.toHaveBeenCalled();
  });

  it("获取失败时也应写入最新检查时间", async () => {
    execaMock.mockRejectedValue(new Error("network down"));

    await checkLatestVersion();

    expect(execaMock).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledTimes(1);

    const mgr = new InternalConfigManager();
    expect(mgr.get("lastVersionCheckAt").value).toBe(Date.now());
  });
});
