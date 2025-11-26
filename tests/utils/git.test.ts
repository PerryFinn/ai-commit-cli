import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execaSync } from "execa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitFileStatus, GitService, getRepoRoot } from "@/utils/git";

describe("GitService - 单元测试", () => {
  let tempDir: string;
  let gitService: GitService;

  /**
   * 创建临时 Git 仓库用于测试
   * 使用 realpathSync 解决 macOS 上 /var -> /private/var 符号链接问题
   */
  const createTempRepo = (): string => {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "git-test-")));
    execaSync("git", ["init"], { cwd: dir });
    execaSync("git", ["config", "user.email", "test@test.com"], { cwd: dir });
    execaSync("git", ["config", "user.name", "Test User"], { cwd: dir });
    return dir;
  };

  /**
   * 清理临时目录
   */
  const cleanupTempDir = (dir: string): void => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // 忽略清理失败
    }
  };

  beforeEach(() => {
    tempDir = createTempRepo();
    gitService = new GitService(tempDir);
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe("getRepoRoot", () => {
    it("应该返回 Git 仓库根目录", () => {
      const root = gitService.getRepoRoot();
      expect(root).toBe(tempDir);
    });

    it("在非 Git 仓库中应该返回 undefined", () => {
      const nonRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "non-git-"));
      const service = new GitService(nonRepoDir);
      expect(service.getRepoRoot()).toBeUndefined();
      cleanupTempDir(nonRepoDir);
    });
  });

  describe("isInsideRepo", () => {
    it("在 Git 仓库中应该返回 true", () => {
      expect(gitService.isInsideRepo()).toBe(true);
    });

    it("在非 Git 仓库中应该返回 false", () => {
      const nonRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "non-git-"));
      const service = new GitService(nonRepoDir);
      expect(service.isInsideRepo()).toBe(false);
      cleanupTempDir(nonRepoDir);
    });
  });

  describe("getCurrentBranch", () => {
    it("应该返回当前分支名", () => {
      // 新仓库默认分支可能是 main 或 master，取决于 git 配置
      const branch = gitService.getCurrentBranch();
      // 空仓库（无提交）时可能返回 undefined
      // 有提交后应该返回分支名
      if (branch) {
        expect(typeof branch).toBe("string");
      }
    });

    it("有初始提交后应该返回分支名", () => {
      // 创建初始提交
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "test");
      execaSync("git", ["add", "."], { cwd: tempDir });
      execaSync("git", ["commit", "-m", "initial"], { cwd: tempDir });

      const branch = gitService.getCurrentBranch();
      expect(branch).toBeDefined();
      expect(["main", "master"]).toContain(branch);
    });
  });

  describe("getStagedFiles", () => {
    it("没有暂存文件时应该返回空数组", () => {
      expect(gitService.getStagedFiles()).toEqual([]);
    });

    it("应该返回暂存的新增文件", () => {
      const testFile = path.join(tempDir, "new-file.txt");
      fs.writeFileSync(testFile, "content");
      execaSync("git", ["add", "new-file.txt"], { cwd: tempDir });

      const staged = gitService.getStagedFiles();
      expect(staged).toHaveLength(1);
      expect(staged[0]).toEqual({
        status: GitFileStatus.Added,
        path: "new-file.txt"
      });
    });

    it("应该返回暂存的修改文件", () => {
      // 先创建并提交一个文件
      const testFile = path.join(tempDir, "modify.txt");
      fs.writeFileSync(testFile, "original");
      execaSync("git", ["add", "."], { cwd: tempDir });
      execaSync("git", ["commit", "-m", "initial"], { cwd: tempDir });

      // 修改并暂存
      fs.writeFileSync(testFile, "modified");
      execaSync("git", ["add", "modify.txt"], { cwd: tempDir });

      const staged = gitService.getStagedFiles();
      expect(staged).toHaveLength(1);
      expect(staged[0]).toEqual({
        status: GitFileStatus.Modified,
        path: "modify.txt"
      });
    });

    it("应该返回暂存的删除文件", () => {
      // 先创建并提交一个文件
      const testFile = path.join(tempDir, "delete.txt");
      fs.writeFileSync(testFile, "content");
      execaSync("git", ["add", "."], { cwd: tempDir });
      execaSync("git", ["commit", "-m", "initial"], { cwd: tempDir });

      // 删除并暂存
      fs.unlinkSync(testFile);
      execaSync("git", ["add", "delete.txt"], { cwd: tempDir });

      const staged = gitService.getStagedFiles();
      expect(staged).toHaveLength(1);
      expect(staged[0]).toEqual({
        status: GitFileStatus.Deleted,
        path: "delete.txt"
      });
    });
  });

  describe("getStatus", () => {
    it("在非 Git 仓库中应该返回 isRepo: false", () => {
      const nonRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "non-git-"));
      const service = new GitService(nonRepoDir);
      const status = service.getStatus();

      expect(status.isRepo).toBe(false);
      expect(status.hasStagedChanges).toBe(false);
      expect(status.staged).toEqual([]);

      cleanupTempDir(nonRepoDir);
    });

    it("应该返回完整的仓库状态", () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "content");
      execaSync("git", ["add", "."], { cwd: tempDir });

      const status = gitService.getStatus();
      expect(status.isRepo).toBe(true);
      expect(status.hasStagedChanges).toBe(true);
      expect(status.staged).toHaveLength(1);
    });
  });

  describe("getStagedDiff", () => {
    it("没有暂存变更时应该返回空字符串", () => {
      expect(gitService.getStagedDiff()).toBe("");
    });

    it("应该返回暂存区的 diff", () => {
      const testFile = path.join(tempDir, "diff-test.txt");
      fs.writeFileSync(testFile, "hello world");
      execaSync("git", ["add", "."], { cwd: tempDir });

      const diff = gitService.getStagedDiff();
      expect(diff).toContain("diff --git");
      expect(diff).toContain("hello world");
    });

    it("应该支持 maxLength 截断", () => {
      const testFile = path.join(tempDir, "long-file.txt");
      fs.writeFileSync(testFile, "a".repeat(1000));
      execaSync("git", ["add", "."], { cwd: tempDir });

      const diff = gitService.getStagedDiff({ maxLength: 100 });
      expect(diff.length).toBeLessThanOrEqual(130); // 100 + truncation message
      expect(diff).toContain("[diff truncated]");
    });
  });

  describe("getStagedDiffStat", () => {
    it("应该返回 diff 统计信息", () => {
      const testFile = path.join(tempDir, "stat-test.txt");
      fs.writeFileSync(testFile, "line1\nline2\nline3");
      execaSync("git", ["add", "."], { cwd: tempDir });

      const stat = gitService.getStagedDiffStat();
      expect(stat).toContain("stat-test.txt");
      expect(stat).toContain("insertion");
    });
  });

  describe("commit", () => {
    it("应该执行提交", () => {
      const testFile = path.join(tempDir, "commit-test.txt");
      fs.writeFileSync(testFile, "content");
      execaSync("git", ["add", "."], { cwd: tempDir });

      gitService.commit("test commit message");

      // 验证提交成功
      const logResult = execaSync("git", ["log", "--oneline", "-1"], { cwd: tempDir });
      expect(logResult.stdout).toContain("test commit message");
    });

    it("空提交信息应该抛出错误", () => {
      expect(() => gitService.commit("")).toThrow("Commit message cannot be empty");
      expect(() => gitService.commit("   ")).toThrow("Commit message cannot be empty");
    });
  });

  describe("add", () => {
    it("应该添加指定文件到暂存区", () => {
      const testFile = path.join(tempDir, "add-test.txt");
      fs.writeFileSync(testFile, "content");

      gitService.add(["add-test.txt"]);

      const staged = gitService.getStagedFiles();
      expect(staged).toHaveLength(1);
      expect(staged[0]?.path).toBe("add-test.txt");
    });

    it("无参数时应该添加所有变更", () => {
      fs.writeFileSync(path.join(tempDir, "file1.txt"), "1");
      fs.writeFileSync(path.join(tempDir, "file2.txt"), "2");

      gitService.add();

      const staged = gitService.getStagedFiles();
      expect(staged).toHaveLength(2);
    });
  });
});

describe("getRepoRoot 便捷函数", () => {
  it("应该返回仓库根目录", () => {
    // 在当前项目目录测试
    const root = getRepoRoot();
    expect(root).toBeDefined();
    expect(fs.existsSync(path.join(root as string, ".git"))).toBe(true);
  });
});
