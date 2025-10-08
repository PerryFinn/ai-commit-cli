# 功能架构设计总览

本设计文档基于当前 `ai-commit-cli` 代码库，对现有能力与未来扩展方向进行结构化梳理，便于新成员快速理解整体架构并在此基础上演进 AI 辅助提交信息的完整体验。

> **引用说明**：文档中形如 `【F:src/config/ConfigManager.ts】` 的标注用于指向仓库内的源文件，`F:` 表示文件引用，便于读者快速定位实现细节。

## 设计目标

- **CLI 入口统一化**：为所有子命令提供一致的启动流程、日志体验与错误处理策略。
- **配置能力模块化**：将配置枚举、存储、校验与 CLI 交互拆分为独立层次，便于扩展新项或替换存储方案。
- **环境感知与优先级管理**：支持命令行环境变量、`.env` 与本地配置三层合并，确保不同部署环境下的行为可预期。
- **服务扩展预留**：在保持当前配置命令可用的前提下，为后续“AI 生成提交信息”功能预留服务抽象、Provider 插拔点与测试策略。
- **可维护性**：通过严格的类型约束、单元测试与文档化流程，降低长期维护成本。

## 系统分层

```
┌────────────────────────────────────────────────────────────┐
│                         CLI 层 (Interface)                 │
│  src/index.ts → cli/parser.ts → cli/commands/*             │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│                应用层 (Application / Services)             │
│  config/ConfigManager.ts   utils/env.ts   utils.ts         │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│                    基础设施 (Infrastructure)               │
│  types/config.ts  package.json  bunfig.toml  tsconfig.json │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│                       测试与质量保障                       │
│  tests/**  bun run lint|test|typecheck|ci                  │
└────────────────────────────────────────────────────────────┘
```

## 核心模块职责

### 1. CLI 入口与命令解析
- `src/index.ts`：初始化 CLI 流程，负责展示欢迎语、捕获 `ExitPromptError` 并统一退出码。【F:src/index.ts】
- `src/cli/parser.ts`：基于 `mri` 解析命令行参数，路由至各子命令，同时提供 `help` 文案与友好的错误提示。【F:src/cli/parser.ts】
- `src/cli/commands/config.ts`：实现 `set`/`get`/`ls` 子命令，处理键值解析、类型转换、表格输出与错误提示。【F:src/cli/commands/config.ts】

### 2. 配置域
- `src/types/config.ts`：集中维护 11 个配置项、对应的 TypeScript 类型与 JSON Schema 属性，禁止使用 `enum`，便于 `as const` 推断与运行时校验。【F:src/types/config.ts】
- `src/config/ConfigManager.ts`：负责配置值的读取、写入、来源标记、类型校验与优先级合并，内部基于 `conf` 实现持久化。【F:src/config/ConfigManager.ts】
- `docs/config-management-design.md`：对配置系统的工作流程、优先级策略与扩展指南做了进一步说明，可与本总览互相引用以获取细节。【F:docs/config-management-design.md】

### 3. 环境工具与通用工具
- `src/utils/env.ts`：提供环境变量名规范化、合法性校验、`.env` 查找与解析、环境映射合并等能力，是 ConfigManager 的输入来源之一。【F:src/utils/env.ts】
- `src/utils.ts`：封装基础字符串与错误信息工具，供 CLI 输出与其他模块复用。【F:src/utils.ts】
- `src/utils/checkIsLatestVersion.ts`：封装版本检测逻辑，未来可在 CLI 启动时启用提示用户更新。【F:src/utils/checkIsLatestVersion.ts】

### 4. 测试与质量保障
- `tests/config/ConfigManager.test.ts`：验证配置优先级、类型校验与来源标记等关键行为，并通过 mock `conf` 避免文件系统依赖。【F:tests/config/ConfigManager.test.ts】
- `tests/cli/commands/config.test.ts`：确保 CLI 命令层正确调用 ConfigManager、处理参数与错误情况。【F:tests/cli/commands/config.test.ts】
- `tests/utils.test.ts`：覆盖基础工具函数的行为，保证公共函数稳定。【F:tests/utils.test.ts】
- `package.json` 中的脚本 `bun run lint|typecheck|test|ci` 形成提交前质量门禁，结合 Husky/Commitlint 保证规范提交（详见仓库根部协作指南）。【F:README.md】

## 运行时流程

1. `node dist/index.cjs` / `bun run debug` → 入口脚本调用 `runCLI()` 并展示 intro/outro。
2. `runCLI` 使用 `mri` 解析参数，判断主命令：
   - `config` → 进入配置子命令处理。
   - 其他命令 → 提示未知命令（为未来主功能预留扩展点）。【F:src/cli/parser.ts】
3. 配置子命令中：
   - `ConfigManager` 接受 CLI 环境变量（由 `normalizeCliEnv` 过滤）与 `.env` 文件内容，并加载 `conf` 持久化层。
   - 读取/设置时遵循优先级：CLI env → `.env` → config store，返回值附带 `source`。
   - CLI 层负责输出格式化结果，并以统一颜色提示来源或错误。

## 扩展路线图（AI 提交生成功能）

为实现核心的 “AI 自动生成 Conventional Commit” 能力，建议按照下列架构逐步落地：

1. **命令层扩展**
   - 新增 `src/cli/commands/commit.ts` 与 `aigcm commit` 子命令，在 `parser.ts` 中注册。
   - 该命令需 orchestrate 下述服务：Git 变更收集 → Prompt 构建 → LLM Provider 调用 → 消息格式化。

2. **领域服务与适配层**
   - 在 `src/services/`（新建目录）中定义 `CommitGenerationService`：接受上下文（diff、配置、用户输入），输出候选提交信息。
   - 引入 Provider 抽象（可放置于 `src/services/providers/`）以适配 OpenAI、Ollama、Gemini、Dify，利用 `AIGCM_LLM_PROVIDER` 与 `AIGCM_BASE_URL` 等配置进行差异化初始化。
   - 设计 `PromptModule` 机制（与 `AIGCM_PROMPT_MODULE` 对应），允许通过策略模式切换不同提示模板。

3. **基础设施增强**
   - 在 `src/utils/git.ts`（待新增）封装 `git diff`、`git status`、`git rev-parse` 等操作，便于测试时注入 mock。
   - 扩展 `ConfigManager`：
     - 支持读取默认值（如未配置 API Key 时提示交互式输入）。
     - 对敏感配置提供掩码输出或检测缺失提示。

4. **交互与回退策略**
   - 使用 `@clack/prompts` 继续提供交互式多选/确认流程。
   - 生成多条候选消息供用户选择，可配合 `AIGCM_ONE_LINE_COMMIT` 与 `AIGCM_OMIT_COMMIT_SCOPE` 控制格式。
  - 支持失败回退：若 LLM 请求失败，提示用户手动输入。

5. **测试策略**
   - CLI 层：通过 Vitest + `vi.mock` 模拟服务层，断言参数传递与错误处理。
   - 服务层：对 Prompt 生成、Provider 调用进行单元测试；对 Git 工具编写集成测试（可利用临时仓库）。
   - E2E（后续）：考虑使用真实 git 仓库快照与 mock LLM 响应做端到端回归。

## 维护建议

- **文档联动**：当新增配置项或 Provider 时，更新本文件与 `docs/config-management-design.md`，保持文档与实现同步。
- **类型优先**：所有对外导出的 API 保持显式返回类型，若新增公共工具请集中在 `src/utils/` 并在 `src/index.ts` 中统一导出。
- **命令解耦**：新增 CLI 子命令时，将复杂逻辑拆分至 `services` 或 `utils` 层，避免命令文件过重。
- **错误策略**：优先使用 `ConfigManager` 的校验能力与 CLI 层彩色输出，确保用户能快速定位问题。
- **CI 流程**：保持 `bun run ci` 通过后再提交；若修改依赖或打包配置，请同步更新 `README` 对应章节。

## 关联文档

- [配置管理系统设计](./config-management-design.md)：聚焦配置项与优先级的详细说明。
- [仓库协作指南](../AGENTS.md)：约束代码风格、提交规范与提交流程，贡献者需首先阅读。

通过以上架构说明，维护者可以快速定位现有代码职责，并按阶段构建 AI 提交生成功能所需的服务与命令模块，确保后续演进具备清晰路线与足够的扩展点。
