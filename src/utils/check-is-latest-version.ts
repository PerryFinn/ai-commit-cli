import { log } from "@clack/prompts";
import { type ExecaError, execa } from "execa";
import { bold, red, yellow } from "picocolors";
import { InternalConfigManager } from "@/config/internal-config-manager";
import { version as curPkgVersion, name as pkgName } from "../../package.json";

export const VERSION_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

export const getAICommitCLILatestVersion: () => Promise<string | undefined> = async () => {
  try {
    const { stdout } = await execa("npm", ["view", pkgName, "version"]);
    return stdout;
  } catch (_: unknown) {
    const error = _ as ExecaError;
    log.error(red(`获取 ${bold(pkgName)} 最新版本失败：\n${error.message}`));
    // TODO: 日志记录
    return undefined;
  }
};

const shouldSkipVersionCheck = (lastCheckedAt: number | undefined, now: number): boolean => {
  if (lastCheckedAt === undefined) return false;
  return now - lastCheckedAt < VERSION_CHECK_INTERVAL_MS;
};

export const checkLatestVersion = async (): Promise<void> => {
  const internalConfigManager = new InternalConfigManager();
  const lastCheckedAt = internalConfigManager.get("lastVersionCheckAt").value;
  const now = Date.now();

  if (shouldSkipVersionCheck(lastCheckedAt, now)) return;

  const latestVersion = await getAICommitCLILatestVersion();
  internalConfigManager.set("lastVersionCheckAt", now);

  if (latestVersion && latestVersion !== curPkgVersion) {
    const installCmdPrompt = `npm install -g ${pkgName}@latest`;
    log.info(
      yellow(
        `✨ ${pkgName} 有点小进步（${curPkgVersion} → ${latestVersion}）。快来更新，让 AI 帮你写得更顺手：${installCmdPrompt}`
      )
    );
  }
};
