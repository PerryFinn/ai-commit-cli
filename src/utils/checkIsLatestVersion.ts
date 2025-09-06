import { log } from "@clack/prompts";
import { type ExecaError, execa } from "execa";
import { bold, red, yellow } from "picocolors";
import { version as curPkgVersion, name as pkgName } from "../../package.json";

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

export const checkLatestVersion = async (): Promise<void> => {
  const latestVersion = await getAICommitCLILatestVersion();
  if (latestVersion && latestVersion !== curPkgVersion) {
    const installCmd = `npm install -g ${pkgName}@latest`;
    log.info(
      yellow(`✨ ${pkgName} 有点小进步（${curPkgVersion} → ${latestVersion}）。让 AI 帮你写得更顺手：${installCmd}`)
    );
  }
};
