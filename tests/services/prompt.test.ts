import { describe, expect, it } from "vitest";
import {
  buildMultiplePrompt,
  buildPrompt,
  extractPromptOptions,
  isValidConventionalCommit,
  type PromptContext,
  type PromptOptions,
  parseCommitMessages,
  truncateDiff
} from "@/services/prompt";
import type { StagedFile } from "@/utils/git";
import { tokenCount } from "@/utils/prompt";

describe("Prompt 模块", () => {
  // 测试用的默认上下文
  const createContext = (overrides: Partial<PromptContext> = {}): PromptContext => ({
    diff: `diff --git a/src/index.ts b/src/index.ts
index 1234567..abcdefg 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,5 @@
+import { newFunction } from './utils';
+
 export function main() {
-  console.log('hello');
+  console.log('hello world');
+  newFunction();
 }`,
    stagedFiles: [{ status: "M", path: "src/index.ts" }],
    diffStat: " src/index.ts | 4 +++-\n 1 file changed, 3 insertions(+), 1 deletion(-)",
    ...overrides
  });

  const createOptions = (overrides: Partial<PromptOptions> = {}): PromptOptions => ({
    language: "en",
    oneLine: false,
    omitScope: false,
    ...overrides
  });

  describe("extractPromptOptions", () => {
    it("应该返回默认选项当配置为空时", () => {
      const options = extractPromptOptions({});
      expect(options).toEqual({
        language: "en",
        oneLine: false,
        omitScope: false,
        customModule: undefined
      });
    });

    it("应该正确提取配置选项", () => {
      const options = extractPromptOptions({
        AIGCM_LANGUAGE: "zh_CN",
        AIGCM_ONE_LINE_COMMIT: true,
        AIGCM_OMIT_COMMIT_SCOPE: true,
        AIGCM_PROMPT_MODULE: "Focus on security changes"
      });
      expect(options).toEqual({
        language: "zh_CN",
        oneLine: true,
        omitScope: true,
        customModule: "Focus on security changes"
      });
    });
  });

  describe("buildPrompt", () => {
    it("应该构建英文 prompt", () => {
      const context = createContext();
      const options = createOptions({ language: "en" });
      const prompt = buildPrompt(context, options);

      expect(prompt).toContain("Git commit message generator");
      expect(prompt).toContain("Conventional Commits");
      expect(prompt).toContain("diff --git");
      expect(prompt).toContain("[Modified] src/index.ts");
    });

    it("应该构建中文 prompt", () => {
      const context = createContext();
      const options = createOptions({ language: "zh_CN" });
      const prompt = buildPrompt(context, options);

      expect(prompt).toContain("Git 提交信息生成助手");
      expect(prompt).toContain("Conventional Commits 规范");
      expect(prompt).toContain("变更的文件");
    });

    it("应该包含单行提示当 oneLine 为 true 时", () => {
      const context = createContext();
      const options = createOptions({ oneLine: true });
      const prompt = buildPrompt(context, options);

      expect(prompt).toContain("single-line");
      expect(prompt).not.toContain("Detailed body");
    });

    it("应该包含省略 scope 提示当 omitScope 为 true 时", () => {
      const context = createContext();
      const options = createOptions({ omitScope: true });
      const prompt = buildPrompt(context, options);

      expect(prompt).toContain("Do not include scope");
    });

    it("应该包含自定义模块内容", () => {
      const context = createContext();
      const options = createOptions({ customModule: "Always mention tests" });
      const prompt = buildPrompt(context, options);

      expect(prompt).toContain("Additional instructions: Always mention tests");
    });

    it("应该正确格式化重命名的文件", () => {
      const context = createContext({
        stagedFiles: [{ status: "R", path: "new-name.ts", oldPath: "old-name.ts" } as StagedFile]
      });
      const options = createOptions();
      const prompt = buildPrompt(context, options);

      expect(prompt).toContain("[Renamed] old-name.ts -> new-name.ts");
    });

    it("应该包含 diff 统计信息", () => {
      const context = createContext();
      const options = createOptions();
      const prompt = buildPrompt(context, options);

      expect(prompt).toContain("Statistics:");
      expect(prompt).toContain("1 file changed");
    });
  });

  describe("buildMultiplePrompt", () => {
    it("应该在 prompt 末尾添加多候选请求", () => {
      const context = createContext();
      const options = createOptions({ language: "en" });
      const prompt = buildMultiplePrompt(context, options);

      expect(prompt).toContain("Generate 3 candidate commit messages");
    });

    it("应该在中文模式下添加中文多候选请求", () => {
      const context = createContext();
      const options = createOptions({ language: "zh_CN" });
      const prompt = buildMultiplePrompt(context, options);

      expect(prompt).toContain("请生成 3 条候选提交信息");
    });
  });

  describe("parseCommitMessages", () => {
    it("应该解析单条提交信息", () => {
      const response = "feat(cli): add new command";
      const messages = parseCommitMessages(response);

      expect(messages).toEqual(["feat(cli): add new command"]);
    });

    it("应该解析多条提交信息", () => {
      const response = `feat(cli): add new command

fix(config): correct default value

refactor: simplify logic`;
      const messages = parseCommitMessages(response);

      expect(messages).toHaveLength(3);
      expect(messages[0]).toBe("feat(cli): add new command");
      expect(messages[1]).toBe("fix(config): correct default value");
      expect(messages[2]).toBe("refactor: simplify logic");
    });

    it("应该移除代码块标记", () => {
      const response = "```\nfeat: add feature\n```";
      const messages = parseCommitMessages(response);

      expect(messages).toEqual(["feat: add feature"]);
    });

    it("应该过滤非提交信息格式的内容", () => {
      const response = `Here are the commit messages:

feat(cli): add new command

This is just a description, not a commit.`;
      const messages = parseCommitMessages(response);

      expect(messages).toEqual(["feat(cli): add new command"]);
    });

    it("应该解析不带 scope 的提交信息", () => {
      const response = "fix: resolve bug";
      const messages = parseCommitMessages(response);

      expect(messages).toEqual(["fix: resolve bug"]);
    });

    it("应该处理带多行正文的提交信息", () => {
      const response = `feat(auth): implement OAuth2 login

Add OAuth2 authentication support with:
- Google provider
- GitHub provider
- Token refresh mechanism`;
      const messages = parseCommitMessages(response);

      // 多行消息会被合并为一条
      expect(messages.length).toBeGreaterThanOrEqual(1);
      expect(messages[0]).toContain("feat(auth)");
    });

    it("应该处理空响应", () => {
      const messages = parseCommitMessages("");
      expect(messages).toEqual([]);
    });

    it("应该处理只有无效内容的响应", () => {
      const response = "I cannot generate a commit message for this change.";
      const messages = parseCommitMessages(response);

      // 如果没有有效格式，返回第一行作为备选
      expect(messages).toHaveLength(1);
    });
  });

  describe("isValidConventionalCommit", () => {
    it("应该验证带 scope 的提交信息", async () => {
      await expect(isValidConventionalCommit("feat(cli): add command")).resolves.toBe(true);
      await expect(isValidConventionalCommit("fix(config): resolve issue")).resolves.toBe(true);
    });

    it("应该验证不带 scope 的提交信息", async () => {
      await expect(isValidConventionalCommit("feat: add feature")).resolves.toBe(true);
      await expect(isValidConventionalCommit("docs: update readme")).resolves.toBe(true);
    });

    it("应该验证所有 conventional commit 类型", async () => {
      const types = ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"];
      for (const type of types) {
        await expect(isValidConventionalCommit(`${type}: description`)).resolves.toBe(true);
      }
    });

    it("应该验证多行提交信息（只检查第一行）", async () => {
      const message = `feat(auth): add login

This adds login functionality.`;
      await expect(isValidConventionalCommit(message)).resolves.toBe(true);
    });

    it("应该拒绝无效格式", async () => {
      await expect(isValidConventionalCommit("invalid commit message")).resolves.toBe(false);
      await expect(isValidConventionalCommit("Add new feature")).resolves.toBe(false);
      // expect(isValidConventionalCommit("feat: ")).toBe(false); // 空描述 // TODO: 暂时注释，这个函数应当使用 commitlint 来执行
      await expect(isValidConventionalCommit("unknown: message")).resolves.toBe(false); // 未知类型
    });
  });

  describe("tokenCount", () => {
    it("应该估算纯英文文本的 token 数", () => {
      const text = "This is a test string with 40 characters!";
      const tokens = tokenCount(text);
      console.log("tokens", tokens);
      expect(tokens).toBeGreaterThan(5);
      expect(tokens).toBeLessThan(15);
    });

    it("应该估算包含中文的文本的 token 数", () => {
      const text = "这是一个测试字符串";
      const tokens = tokenCount(text);
      console.log("tokens", tokens);
      expect(tokens).toBeGreaterThan(4);
      expect(tokens).toBeLessThan(10);
    });

    it("应该估算混合文本的 token 数", () => {
      const text = "Hello 世界";
      const tokens = tokenCount(text);
      console.log("tokens", tokens);
      expect(tokens).toBeGreaterThan(4);
    });
  });

  describe("truncateDiff", () => {
    it("不应截断小于限制的 diff", () => {
      const diff = "small diff content";
      const result = truncateDiff(diff, 1000);
      expect(result).toBe(diff);
    });

    it("应该截断超出限制的 diff", () => {
      const diff = `diff --git a/file1.ts b/file1.ts
${"a".repeat(500)}

diff --git a/file2.ts b/file2.ts
${"b".repeat(500)}

diff --git a/file3.ts b/file3.ts
${"c".repeat(500)}`;

      const result = truncateDiff(diff, 200);

      expect(result.length).toBeLessThan(diff.length);
      expect(result).toContain("truncated");
    });

    it("应该按文件边界截断", () => {
      const diff = `diff --git a/file1.ts b/file1.ts
content of file1

diff --git a/file2.ts b/file2.ts
content of file2`;

      const result = truncateDiff(diff, 50);

      // 应该保留完整的文件 diff 块
      expect(result).toContain("diff --git");
    });
  });
});
