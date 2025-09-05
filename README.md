# create-npm-package

一个用于快速搭建 npm 包的工程模板，内置 TypeScript、打包、测试、提交规范、发布流程等最佳实践，开箱即用。

## 特性

- TypeScript 严格模式与现代 TS 配置（`strict`、`noUncheckedIndexedAccess` 等）
- 使用 tsdown 打包产出 CJS/ESM，同时生成类型声明（`.d.ts`）与 Source Map
- 完整的 ESM/CJS 导出映射（`package.json#exports`、`main`、`module`、`types`）
- Biome 提供 Lint/格式化与简易 CI 集成
- Vitest 测试，V8 覆盖率，内置最低 90% 的覆盖率门槛（`bunfig.toml`）
- Changesets 版本与发布流程，并支持自定义提交消息（`scripts/changeset.commit.ts`）
- Husky + lint-staged + Commitlint 提交质量门禁（约定式提交）
- 仅允许使用 Bun 安装依赖（`only-allow bun`），避免包管理混乱
- 使用 Volta 固定 Node 版本，确保一致的本地/CI 环境
- `attw`（AreTheTypesWrong）导出与类型正确性校验

## 环境要求

- Node >= 22（Volta 固定为 22.19.0）
- Bun >= 1.0.0
- 包管理器：仅支持 Bun（`preinstall` 钩子会阻止 npm/yarn/pnpm）

## 安装

```bash
bun install
```

## 快速开始（本地演示入口）

```bash
bun run src/index.ts
```

示例会调用 `src/utils.ts` 中的 `add` 方法并输出计算结果。

## 作为库使用

当你将本模板产物发布到 npm 后，可按如下方式在其他项目中使用。

ESM：

```ts
import { add, type DemoType } from 'create-npm-package';

const result = add(2, 3);
console.log(result); // 5

const user: DemoType = { name: 'Tom' };
```

CJS：

```js
const { add } = require('create-npm-package');

console.log(add(2, 3)); // 5
```

## 常用脚本

- 开发与质量
  - `bun run lint`：Biome 检查
  - `bun run lint:fix`：Biome 自动修复
  - `bun run typecheck`：TypeScript 类型检查
  - `bun run test`：Vitest 全量测试
  - `bun run test:watch`：Vitest 监听模式
  - `bun run test:coverage`：生成覆盖率报告
- 构建与校验
  - `bun run build`：使用 tsdown 打包（CJS/ESM + d.ts + sourcemap → `dist/`）
  - `bun run check:exports`：使用 `attw` 校验导出与类型
- 发布（Changesets）
  - `bun run release:version`：根据变更集生成版本号与 `CHANGELOG`
  - `bun run release`：发布到当前 registry（需已登录）
- 其他
  - `bun run ci`：本地串跑 CI（lint → typecheck → test → build → check:exports）
  - `bun run build:changeset`：编译 `scripts/changeset.commit.ts` 为 `.changeset/changeset.commit.cjs`

> 说明：`prepublishOnly` 会在发布前自动执行 `bun run ci`，确保发布质量。

## 目录结构

```text
.
├─ src/
│  ├─ index.ts          # 库入口与对外导出示例
│  └─ utils.ts          # 示例工具函数（add）
├─ tests/
│  └─ utils.test.ts     # Vitest 示例用例
├─ scripts/
│  └─ changeset.commit.ts   # Changesets 自定义提交消息生成逻辑
├─ dist/                 # 构建产物（build 后生成）
├─ tsdown.config.ts      # 打包配置（含 changeset 构建目标）
├─ vitest.config.ts      # 测试配置（V8 覆盖率）
├─ bunfig.toml           # Bun 配置（覆盖率阈值、registry）
├─ tsconfig.json         # TypeScript 配置（严格模式等）
├─ package.json          # 脚本、导出映射、引擎/工具声明等
└─ CHANGELOG.md          # 版本变更记录（由 Changesets 生成）
```

## 构建与产物说明

- 入口：`src/index.ts`
- 产物目录：`dist/`
- 产物类型：
  - `index.js`（ESM）
  - `index.cjs`（CJS）
  - `index.d.ts` / `index.d.cts`（类型声明）
  - `*.map`（Source Map）
- 导出映射：见 `package.json#exports`，同时提供 `main/module/types` 字段方便生态工具识别。

## 测试

使用 Vitest，覆盖率提供方为 V8：

```bash
bun run test
bun run test:coverage
```

## 版本与发布（Changesets）

1. 添加变更集（选择变更类型并填写说明）：

   ```bash
   bunx changeset
   ```

2. 生成版本号与变更日志：

   ```bash
   bun run release:version
   ```

3. 发布到 npm（或当前 registry）：

   ```bash
   bun run release
   ```

可选：若需自定义 Changesets 的提交消息格式，执行：

```bash
bun run build:changeset
```

该命令会将 `scripts/changeset.commit.ts` 编译为 `.changeset/changeset.commit.cjs`，供 Changesets 读取使用。

## FAQ

- 为什么只能用 Bun 安装依赖？
  - 本模板使用 `only-allow bun` 在 `preinstall` 阶段强制 Bun，确保依赖树一致性与更快的安装速度。
- Node 版本不满足怎么办？
  - 请将 Node 升级到 >=22，或使用 Volta/`nvm` 切换到合适版本。仓库使用 Volta 固定为 22.19.0。
- `attw` 检查失败？
  - 说明导出或类型存在潜在问题，请根据错误信息调整导出或类型定义，然后重新 `bun run build && bun run check:exports`。

## 许可证

MIT © PerryFinn
