import { log } from "@clack/prompts";
import Config from "@npmcli/config";
import { definitions, flatten, shorthands } from "@npmcli/config/lib/definitions";
import npmRegistryFetch from "npm-registry-fetch";
import { bold, red, yellow } from "picocolors";
import { InternalConfigManager } from "@/config/internal-config-manager";
import { version as curPkgVersion, name as pkgName } from "../../package.json";

export const VERSION_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 12; // 12 小时检查一次
const VERSION_CHECK_TIMEOUT_MS = 3 * 1000; // 3s：够用又不拖慢 CLI
const DEFAULT_NPM_REGISTRY = "https://registry.npmjs.org/";

/**
 * 读取合并后的 npm 配置并构造 registry fetch 参数，确保与用户本地 npm 行为一致。
 */
const buildFetchOptions = async (): Promise<npmRegistryFetch.Options> => {
  try {
    const config = new Config({
      npmPath: process.cwd(),
      definitions,
      shorthands,
      flatten,
      cwd: process.cwd()
    });

    await config.load();

    const flatOptions = config.flat as npmRegistryFetch.Options;
    const registry = npmRegistryFetch.pickRegistry(pkgName, flatOptions);

    return { ...flatOptions, registry };
  } catch {
    return { registry: DEFAULT_NPM_REGISTRY };
  }
};

/**
 * 从当前有效 registry 拉取 CLI 最新版本号。
 */
export const getAICommitCLILatestVersion: () => Promise<string | undefined> = async () => {
  const fetchOptions = await buildFetchOptions();
  const payload = (await npmRegistryFetch.json(pkgName, {
    ...fetchOptions,
    timeout: typeof fetchOptions.timeout === "number" ? fetchOptions.timeout : VERSION_CHECK_TIMEOUT_MS,
    // 版本检查没必要重试太久（可选）
    retry: { retries: 1 }
  })) as { "dist-tags"?: { latest?: string }; version?: string } | undefined | null;
  const latestVersion = payload?.["dist-tags"]?.latest ?? payload?.version;

  if (!latestVersion) {
    log.error(red(`获取 ${bold(pkgName)} 最新版本失败：响应缺少版本信息`));
  }

  return latestVersion;
};

/**
 * 判断是否还在版本检查间隔内，避免过于频繁地访问 registry。
 */
const shouldSkipVersionCheck = (lastCheckedAt: number | undefined, now: number): boolean => {
  if (lastCheckedAt === undefined) return false;
  return now - lastCheckedAt < VERSION_CHECK_INTERVAL_MS;
};

/**
 * 执行版本检查，提示用户升级，并记录上次检查时间。
 */
export const checkLatestVersion = async (): Promise<void> => {
  const internalConfigManager = new InternalConfigManager();
  const now = Date.now();
  const lastCheckedAt = internalConfigManager.get("lastVersionCheckAt").value;
  if (shouldSkipVersionCheck(lastCheckedAt, now)) return;
  try {
    const latestVersion = await getAICommitCLILatestVersion();

    if (latestVersion && latestVersion !== curPkgVersion) {
      const installCmdPrompt = `npm install -g ${pkgName}@${latestVersion}`;
      log.info(
        yellow(
          `✨ ${pkgName} 有点小进步（${curPkgVersion} → ${latestVersion}）快来更新，让 AI 帮你写得更顺手\n${installCmdPrompt}`
        )
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    log.warn(yellow(`版本检查失败，已跳过：${message}`));
  } finally {
    internalConfigManager.set("lastVersionCheckAt", now);
  }
};
