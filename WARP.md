# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

- 环境与前置条件

  - 包管理器：本仓库通过 preinstall 钩子强制使用 Bun（only-allow bun）。不要用 npm/yarn/pnpm 安装依赖，否则会被阻止。
  - 运行时与版本：Node >= 22，Bun >= 1.0（package.json engines 指定）。Volta 固定 Node 版本为 22.19.0（package.json volta）。
  - npm 源：.npmrc 指向 <https://registry.npmmirror.com。>

- 安装与本地运行

  - 安装依赖：
    - bun install
  - 直接运行演示入口（用于快速验证）：
    - bun run src/index.ts

- 常用脚本与开发循环（全部来自 package.json）

  - 代码检查：
    - Lint：bun run lint
    - 自动修复：bun run lint:fix
    - 类型检查：bun run typecheck
  - 测试（Vitest）：
    - 全量：bun run test
    - 单文件：bunx vitest tests/utils.test.ts
    - 单用例：
      - bun run test -- -t "用例关键字"
      - 或 bunx vitest tests/utils.test.ts -t "用例关键字"
    - 仅与改动相关（与 lint-staged 同步）：bunx vitest related --run
  - 构建与导出校验：
    - 构建：bun run build（tsdown 打包 cjs/esm，产物到 dist，同时生成 d.ts 与 sourcemap）
    - 导出与类型正确性检查：bun run check:exports（attw）
  - CI 本地串跑（与 GitHub Actions 一致）：
    - bun run ci（依次执行 ci、typecheck、test、build、check:exports）

- 版本与发布（Changesets）

  - 常用命令：
    - 新增变更集：bunx changeset
    - 本地出版本并发布到当前 registry：bun run release:local（等价于 changeset version && changeset publish）
  - 其他说明：
    - prepublishOnly 会执行 bun run ci，确保发布前通过质量门禁。
    - 脚本 scripts/changeset.commit.ts 会在构建时产出 .changeset/changeset.commit.cjs（由 tsdown 第二个构建目标完成），用于规范 changeset 提交信息。

- 构建/打包架构（高层视图）

  - TypeScript 源码位于 src/，入口为 src/index.ts，工具函数示例位于 src/utils.ts。
  - tsdown.config.ts 定义两个构建目标：
    - 产出库：输入 src/index.ts，输出 dist（cjs/esm/iife + d.ts + sourcemap，clean=true，target=es2020）。
    - 产出 changeset 提交脚本：输入 scripts/changeset.commit.ts，输出到 .changeset（cjs，clean=false，target=node14）。
  - package.json exports 映射 cjs 与 esm 产物，并提供类型声明；main/module/types 指向 dist。

- 代码组织与测试

  - 入口与导出：src/index.ts（对外导出类型与功能），utils 作为示例工具模块。
  - 测试：tests/\*.test.ts 使用 Vitest（例如 tests/utils.test.ts）。

- 质量与提交规范

  - Biome 负责 Lint/格式化；Husky + lint-staged 在提交前执行：
    - .husky/pre-commit：bunx lint-staged（对 _.{js,jsx,ts,tsx} 先 biome --write 再 vitest related --run；对_.{css,json,jsonc,graphql,gql} 进行 biome --write）。
  - Commitlint：commit-msg 钩子执行 bunx --no -- commitlint --edit ${1}，按 Conventional Commits 校验。
  - Copilot 提交信息要求（来自 .github/.copilot-commit-instructions.md）：
    - 生成中文提交信息，遵循 Conventional Commits 模板：
      - <type>(<scope>): <subject>\n\n<body>\n\n<footer>
    - 每行不超过 72 字符；type 取值：feat, fix, docs, style, refactor, test, chore；body 支持多行与列表。

- CI 概览（GitHub Actions）
  - 触发：pull_request 与 push 到 main。
  - 主要步骤：
    - actions/checkout → 安装 Bun（oven-sh/setup-bun@v2）→ bun install --frozen-lockfile → bun run ci。
  - 通过 concurrency 组配置避免同一分支并发执行。
