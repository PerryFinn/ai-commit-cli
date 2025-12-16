import { execa, execaSync, type ResultPromise } from "execa";

/**
 * Git 命令执行结果
 */
interface GitExecResult {
  stdout: string;
}

/**
 * Git 文件状态
 */
export const GitFileStatus = {
  /** 新增 */
  Added: "A",
  /** 修改 */
  Modified: "M",
  /** 删除 */
  Deleted: "D",
  /** 重命名 */
  Renamed: "R",
  /** 拷贝 */
  Copied: "C",
  /** 未跟踪 */
  Untracked: "?",
  /** 忽略 */
  Ignored: "!"
} as const;

export type GitFileStatus = (typeof GitFileStatus)[keyof typeof GitFileStatus];

/**
 * 暂存区文件信息
 */
export interface StagedFile {
  status: GitFileStatus;
  path: string;
  /** 重命名时的原路径 */
  oldPath?: string;
}

/**
 * Git 仓库状态
 */
export interface GitStatus {
  /** 是否在 Git 仓库中 */
  isRepo: boolean;
  /** 当前分支名 */
  branch?: string;
  /** 暂存区文件列表 */
  staged: StagedFile[];
  /** 是否有暂存的变更 */
  hasStagedChanges: boolean;
}

/**
 * Git 操作封装类
 * 提供仓库根目录获取、状态查询、diff 获取、提交等功能
 */
export class GitService {
  private readonly cwd: string;

  constructor(cwd?: string) {
    this.cwd = cwd ?? process.cwd();
  }

  /**
   * 获取 Git 仓库根目录
   * @returns 仓库根目录路径，不在仓库中时返回 undefined
   */
  getRepoRoot(): string | undefined {
    try {
      const result = this.execGitSync(["rev-parse", "--show-toplevel"]);
      return result.stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 检查当前目录是否在 Git 仓库中
   */
  isInsideRepo(): boolean {
    try {
      this.execGitSync(["rev-parse", "--is-inside-work-tree"]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前分支名
   */
  getCurrentBranch(): string | undefined {
    try {
      const result = this.execGitSync(["rev-parse", "--abbrev-ref", "HEAD"]);
      const branch = result.stdout.trim();
      return branch === "HEAD" ? undefined : branch; // detached HEAD 时返回 undefined
    } catch {
      return undefined;
    }
  }

  /**
   * 获取暂存区文件列表
   */
  getStagedFiles(): StagedFile[] {
    try {
      // --porcelain=v1 保证输出格式稳定
      const result = this.execGitSync(["status", "--porcelain=v1"]);
      const lines = result.stdout.split("\n").filter(Boolean);
      const staged: StagedFile[] = [];

      for (const line of lines) {
        // porcelain 格式: XY PATH 或 XY ORIG -> PATH（重命名）
        const indexStatus = line[0]; // 暂存区状态
        if (indexStatus === " " || indexStatus === "?") continue; // 未暂存或未跟踪

        const rest = line.slice(3); // 跳过 "XY "
        if (line.includes(" -> ")) {
          // 重命名: R  old -> new
          const [oldPath, newPath] = rest.split(" -> ");
          staged.push({
            status: indexStatus as GitFileStatus,
            path: newPath ?? "",
            oldPath
          });
        } else {
          staged.push({
            status: indexStatus as GitFileStatus,
            path: rest
          });
        }
      }

      return staged;
    } catch {
      return [];
    }
  }

  /**
   * 获取 Git 仓库状态
   */
  getStatus(): GitStatus {
    const isRepo = this.isInsideRepo();
    if (!isRepo) {
      return { isRepo: false, staged: [], hasStagedChanges: false };
    }

    const branch = this.getCurrentBranch();
    const staged = this.getStagedFiles();

    return {
      isRepo: true,
      branch,
      staged,
      hasStagedChanges: staged.length > 0
    };
  }

  /**
   * 获取暂存区的 diff 内容
   * @param options.maxLength 最大返回长度（字符数），超出时截断
   */
  getStagedDiff(options?: { maxLength?: number }): string {
    try {
      const result = this.execGitSync(["diff", "--cached", "--no-color"]);
      let diff = result.stdout;

      if (options?.maxLength && diff.length > options.maxLength) {
        diff = `${diff.slice(0, options.maxLength)}\n... [diff truncated]`;
      }

      return diff;
    } catch {
      return "";
    }
  }

  /**
   * 获取暂存区的 diff stat（统计信息）
   */
  getStagedDiffStat(): string {
    try {
      const result = this.execGitSync(["diff", "--cached", "--stat", "--no-color"]);
      return result.stdout;
    } catch {
      return "";
    }
  }

  /**
   * 执行 git commit
   * @param message 提交信息
   * @throws 提交失败时抛出错误
   */
  commit(message: string): void {
    if (!message.trim()) {
      throw new Error("Commit message cannot be empty");
    }
    this.execGitSync(["commit", "-m", message]);
  }

  /**
   * 执行 git add
   * @param paths 要添加的文件路径，默认添加所有变更
   */
  addSync(paths?: string[]): void {
    const args = ["add"];
    if (paths && paths.length > 0) {
      args.push(...paths);
    } else {
      args.push("-A");
    }
    this.execGitSync(args);
  }

  /**
   * 内部方法：执行 git 命令
   */
  private execGitSync(args: string[]): GitExecResult {
    const result = execaSync("git", args, {
      cwd: this.cwd,
      reject: true,
      // 避免输出到控制台
      stdio: ["pipe", "pipe", "pipe"]
    });
    // 确保 stdout 是字符串
    return {
      stdout: typeof result.stdout === "string" ? result.stdout : String(result.stdout ?? "")
    };
  }

  private execGit(args: string[]): ResultPromise<{
    cwd: string;
    reject: true;
    stdio: ["pipe", "pipe", "pipe"];
  }> {
    return execa("git", args, {
      cwd: this.cwd,
      reject: true,
      // 避免输出到控制台
      stdio: ["pipe", "pipe", "pipe"]
    });
  }
}

/**
 * 便捷函数：获取 Git 仓库根目录
 * 用于替代 env.ts 中的直接调用
 */
export const getRepoRoot = (cwd?: string): string | undefined => {
  return new GitService(cwd).getRepoRoot();
};
