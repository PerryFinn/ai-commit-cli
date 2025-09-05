/**
 * Changesets 提交消息自定义配置
 *
 * 该文件用于定义 Changesets 在添加变更集和发布版本时生成的提交消息格式，主要功能包括：
 * 1. 规范提交消息格式，符合约定式提交规范（Conventional Commits）
 * 2. 自动生成包含包版本信息的发布日志
 * 3. 支持通过 skipCI 配置跳过 CI 执行
 *
 * 导出的 defaultCommitFunctions 包含两个核心方法：
 * - getAddMessage: 生成添加 changeset 的提交信息，格式为 docs(changeset): <summary>
 * - getVersionMessage: 生成版本发布提交信息，包含发布的包列表和版本号
 *
 * 使用 [skip ci] 标记来适配 GitHub Actions 等 CI 系统的跳过机制
 */
import type { Changeset, CommitFunctions, ReleasePlan } from "@changesets/types";

type SkipCI = boolean | "add" | "version";

const getAddMessage: CommitFunctions["getAddMessage"] = async (
  changeset: Changeset,
  options: { skipCI?: SkipCI } | null
) => {
  const skipCI = options?.skipCI === "add" || options?.skipCI === true;
  const skipMsg = skipCI ? "\n\n[skip ci]\n" : "";
  return `docs(changeset): ${changeset.summary}${skipMsg}`;
};

const getVersionMessage: CommitFunctions["getVersionMessage"] = async (
  releasePlan: ReleasePlan,
  options: { skipCI?: SkipCI } | null
) => {
  const skipCI = options?.skipCI === "version" || options?.skipCI === true;
  const publishableReleases = releasePlan.releases.filter((release) => release.type !== "none");
  const numPackagesReleased = publishableReleases.length;

  if (publishableReleases.length === 1) {
    const release = publishableReleases[0];
    if (!release) {
      throw new Error("release info is undefined");
    }
    return `chore(release): ${release.name}@${release.newVersion}`;
  }

  const releasesLines = publishableReleases.map((release) => `  ${release.name}@${release.newVersion}`).join("\n");

  return `chore(release): releasing ${numPackagesReleased} package(s)

Releases:
${releasesLines}
${skipCI ? "\n[skip ci]\n" : ""}`;
};

const defaultCommitFunctions: Required<CommitFunctions> = {
  getAddMessage,
  getVersionMessage
};

export default defaultCommitFunctions;
