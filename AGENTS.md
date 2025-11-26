# 仓库协作指南

## 项目结构与模块划分

- 源码位于 `src/`：`src/index.ts` 暴露 CLI 入口；`src/cli/`、`src/config/`、`src/types/`、`src/utils/` 分别存放命令处理、配置工具、共享类型与通用工具。
- 测试位于 `tests/`，目录结构与功能模块对应（例如 `tests/cli/`、`tests/config/`），统一命名为 `*.test.ts` 以便 Vitest 自动发现。
- 构建产物输出到 `dist/`，不要提交；项目脚本与工具配置位于 `scripts/`、`docs/` 以及 `tsconfig.json`、`tsdown.config.ts`、`vitest.config.ts`、`bunfig.toml` 等根目录文件。

## 构建与开发命令

- 使用 `bun install` 安装依赖；Bun 采用 `isolated` linker，目录结构类似 pnpm，其他包管工具亦可使用，但以 `bun.lock` 为准。
- `bun run build`：通过 tsdown 构建 CLI，生成 CJS/ESM 及类型声明到 `dist/`。
- `bun run lint`、`bun run lint:fix`、`bun run typecheck`：保证格式、lint 与类型检查通过，提交前务必执行。
- `bun run test`、`bun run test:watch`、`bun run test:coverage`：分别运行一次性测试、监听模式与覆盖率报告。
- `bun run ci`：串行执行 lint、typecheck、构建与导出检查，是 PR 前置检查。

## 编码规范与命名约定

- 使用 Biome 维持两空格缩进、LF 行尾、120 字符行宽、双引号与分号；格式化可执行 `bun run lint:fix`。
- 遵循 TypeScript 严格模式：导出 API 显式声明返回类型，能使用 `readonly` 时就使用；共享工具集中放在 `src/utils/` 并按需从 `src/index.ts` 重新导出。
- 变量与函数使用 camelCase，类与类型使用 PascalCase，文件名默认使用 kebab-case（导出类的文件如 `ConfigManager.ts` 可例外）。
- **禁止使用 TypeScript `enum`**，统一采用 `as const` 对象结合联合类型，例如：

  ```ts
  export const Language = {
    zh_CN: 'zh_CN',
    en: 'en',
  } as const;

  export type Language = (typeof Language)[keyof typeof Language];
  ```

## 测试规范

- 使用 Vitest；测试文件应放在 `tests/` 下并与功能模块对应，命名为 `*.test.ts`。
- 通过脚本 `bun run test` 执行完整测试，需要监听或覆盖率时使用 `bun run test:watch`、`bun run test:coverage`。
- 优先 mock 外部依赖，但关键 CLI 流程需覆盖端到端测试。

## 提交与 PR 规范

- 遵循 Conventional Commits 规范，例如 `feat(cli): add dify provider`。
- **所有 git commit 信息必须使用中文**，同时保持 Conventional Commits 结构。
- `bun run precommit`（Biome CI + typecheck）由 Husky 在 `pre-commit` 钩子中触发，提交前请确保通过。
- PR 描述需包含行为变更摘要、手动测试步骤与关联 issue；若存在交互改动，请附上 CLI 输出或截图。
- 面向用户的改动在合并前执行 `bunx changeset` 记录发布说明。

## 环境与工具

- 要求 Node 22.x（建议通过 Volta 管理）与 Bun ≥ 1.0.0；必要时执行 `volta install` 对齐版本。
- 通过 `AIGCM_*` 环境变量、`.env` 文件或 CLI 命令（`node ./dist/index.cjs config set ...`）配置所需的 AI 服务凭据与参数。

## 协作说明

所有回复必须使用中文。

## MCP

- 当任务**复杂、目标模糊或需要多轮权衡**时，可以使用 SequentialThinking MCP 工具，以结构化方式拆解问题。
- 可以使用 Context7 MCP 工具获取官方文档与代码示例，提升代码的准确性和时效性。
