import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommitService, canGenerateCommit } from "@/services/commit";
import type { ConfigSchema } from "@/types/config";

// Mock GitService
vi.mock("@/utils/git", () => ({
  GitService: vi.fn().mockImplementation(() => ({
    isInsideRepo: vi.fn().mockReturnValue(true),
    getStatus: vi.fn().mockReturnValue({
      isRepo: true,
      branch: "main",
      staged: [{ status: "M", path: "src/index.ts" }],
      hasStagedChanges: true
    }),
    getStagedFiles: vi.fn().mockReturnValue([{ status: "M", path: "src/index.ts" }]),
    getStagedDiff: vi.fn().mockReturnValue("diff --git a/src/index.ts b/src/index.ts"),
    getStagedDiffStat: vi.fn().mockReturnValue(" 1 file changed, 1 insertion(+)"),
    commit: vi.fn(),
    add: vi.fn()
  }))
}));

// Mock provider factory
vi.mock("@/services/providers/factory", () => ({
  createProvider: vi.fn().mockReturnValue({
    name: "mock-provider",
    generate: vi.fn().mockResolvedValue({
      content: "feat(cli): add new feature\n\nfix: resolve bug\n\nchore: update deps"
    }),
    validateConfig: vi.fn().mockReturnValue(true)
  })
}));

describe("CommitService", () => {
  const createConfig = (overrides: Partial<ConfigSchema> = {}): ConfigSchema => ({
    AIGCM_LLM_PROVIDER: "OPEN_AI",
    AIGCM_API_KEY: "test-api-key",
    AIGCM_MODEL_ID: "gpt-4o",
    ...overrides
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validatePrerequisites", () => {
    it("应该在配置完整且有暂存变更时返回 valid", () => {
      const config = createConfig();
      const service = new CommitService(config);
      const result = service.validatePrerequisites();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该在缺少 LLM Provider 时返回错误", () => {
      const config = createConfig({ AIGCM_LLM_PROVIDER: undefined });
      const service = new CommitService(config);
      const result = service.validatePrerequisites();

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("LLM provider")]));
    });

    it("应该在缺少 API Key 时返回错误", () => {
      const config = createConfig({ AIGCM_API_KEY: undefined });
      const service = new CommitService(config);
      const result = service.validatePrerequisites();

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("API key")]));
    });
  });

  describe("generateCommitMessage", () => {
    it("应该成功生成提交信息候选", async () => {
      const config = createConfig();
      const service = new CommitService(config);
      const result = await service.generateCommitMessage();

      expect(result.candidates).toBeDefined();
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.gitStatus).toBeDefined();
    });

    it("应该限制候选数量", async () => {
      const config = createConfig();
      const service = new CommitService(config);
      const result = await service.generateCommitMessage({ candidateCount: 1 });

      expect(result.candidates.length).toBeLessThanOrEqual(1);
    });
  });

  describe("executeCommit", () => {
    it("应该成功执行提交", () => {
      const config = createConfig();
      const service = new CommitService(config);
      const result = service.executeCommit("feat: test commit");

      expect(result.success).toBe(true);
      expect(result.message).toBe("feat: test commit");
    });

    it("应该在提交信息为空时返回错误", () => {
      const config = createConfig();
      const service = new CommitService(config);
      const result = service.executeCommit("");

      expect(result.success).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("应该在提交信息只有空白时返回错误", () => {
      const config = createConfig();
      const service = new CommitService(config);
      const result = service.executeCommit("   ");

      expect(result.success).toBe(false);
      expect(result.error).toContain("empty");
    });
  });

  describe("getGitStatus", () => {
    it("应该返回 Git 状态", () => {
      const config = createConfig();
      const service = new CommitService(config);
      const status = service.getGitStatus();

      expect(status.isRepo).toBe(true);
      expect(status.branch).toBe("main");
      expect(status.hasStagedChanges).toBe(true);
    });
  });

  describe("getDiffPreview", () => {
    it("应该返回 diff 预览", () => {
      const config = createConfig();
      const service = new CommitService(config);
      const preview = service.getDiffPreview();

      expect(preview).toContain("diff --git");
    });
  });
});

describe("canGenerateCommit", () => {
  it("应该检查是否可以生成提交", () => {
    const config: ConfigSchema = {
      AIGCM_LLM_PROVIDER: "OPEN_AI",
      AIGCM_API_KEY: "test-key"
    };
    const result = canGenerateCommit(config);

    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("errors");
  });
});
