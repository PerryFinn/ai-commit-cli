# 配置管理系统设计

## 系统架构概述

本系统提供统一的配置管理能力，采用三层优先级合并策略：命令行环境变量 > 本地 .env > 配置文件（conf 持久化）。

- 配置定义：`src/types/config.ts` 提供 TypeScript 类型与 JSON Schema。
- 持久化与校验：`src/config/config-manager.ts` 基于 `conf` 存储，使用 JSON Schema 做基本校验。
- 环境处理：`src/utils/env.ts` 提供 `.env` 查找与轻量解析、环境合并。
- CLI 命令：`src/cli/commands/config.ts` 实现 `set/get/ls/validate`，`src/cli/parser.ts` 提供子命令解析与路由。
- 配置验证：`src/config/config-validator.ts` 提供跨配置项的业务规则验证。

## 配置项说明（共 11 项）

- AIGCM_MODEL_ID: 模型 ID，例如 `gpt-4o`, `llama3`, `gemini-pro`。
- AIGCM_LLM_PROVIDER: 枚举 `OPEN_AI|GEMINI|DIFY`。
- AIGCM_DIFY_AUTH_ID: 使用 Dify 时的应用 Auth ID。
- AIGCM_PROMPT_MODULE: 提示词模块标识。
- AIGCM_LANGUAGE: 枚举 `zh_CN|en`。
- AIGCM_ONE_LINE_COMMIT: 是否单行提交信息（boolean）。
- AIGCM_OMIT_COMMIT_SCOPE: 是否省略提交 scope（boolean）。
- AIGCM_MAX_TOKEN_INPUT: 输入 Token 上限（number）。
- AIGCM_MAX_TOKEN_OUTPUT: 输出 Token 上限（number）。
- AIGCM_API_KEY: Provider 的 API Key。
- AIGCM_BASE_URL: Provider 的 Base URL。

## 优先级系统

从高到低：

1. 命令行环境变量（运行时 `process.env` 或显式传入）
2. `.env` 文件（当前工作目录）
3. 配置文件（`conf` 持久化存储）

读取时，按优先级返回值与来源标识（`cli`/`.env`/`config`）。设置时，仅写入配置文件层，不修改 `.env`。

## CLI 命令使用

- 设置：

```bash
aigcm config set AIGCM_MODEL_ID=gpt-4o AIGCM_ONE_LINE_COMMIT=true
```

- 获取：

```bash
aigcm config get AIGCM_MODEL_ID
```

- 列表：

```bash
aigcm config ls
```

- 验证：

```bash
aigcm config validate
```

当值来源于环境变量时，会显示来源标签 `[cli]` 或 `[.env]`。

## 默认值

- 通过 `conf` 的 `defaults` 提供内置默认值：`AIGCM_LLM_PROVIDER=OPEN_AI`、`AIGCM_LANGUAGE=zh_CN`。
- 仍需显式设置 `AIGCM_MODEL_ID`、`AIGCM_API_KEY` 等必要参数。

## 配置验证

`config validate` 命令用于验证当前配置是否满足 AI 提交生成的要求：

- 必须配置 `AIGCM_LLM_PROVIDER` 和 `AIGCM_MODEL_ID`
- 使用 Dify 时必须配置 `AIGCM_DIFY_AUTH_ID`
- 使用 OpenAI/Gemini 时必须配置 `AIGCM_API_KEY`
- 建议配置 `AIGCM_MAX_TOKEN_INPUT`

验证结果分为错误（阻止执行）和警告（建议配置）两级。

## 文件结构

- `src/types/config.ts`：配置枚举、接口与 JSON Schema。
- `src/config/config-manager.ts`：封装三层优先级、类型校验、读写接口。
- `src/config/config-validator.ts`：跨配置项业务规则验证。
- `src/utils/env.ts`：`.env` 查找、解析与合并工具。
- `src/cli/commands/config.ts`：`set/get/ls/validate` 命令实现。
- `src/cli/parser.ts`：顶层命令解析与路由。
- `src/index.ts`：入口文件，委派至 parser。

## 开发者指南

1. 新增配置项：

   - 在 `ConfigSchema` 与 `CONFIG_KEYS` 增加字段；
   - 更新 `configJsonSchema.properties`；
   - 如需枚举，更新相应枚举；
   - 视需要在 CLI 中增加说明。

2. 运行测试：

```bash
bun run test
```

## 扩展指南

- 可在 `ConfigManager` 增加默认值策略或动态校验逻辑；
- 可扩展更多子命令（如 `unset`, `import`, `export`）；
- 可在 `.env` 解析中加入变量引用与多行值支持。

## 故障排查

- “不支持的配置 key”：检查键名是否在 `CONFIG_KEYS`；
- “需要 boolean/number 类型”：值未按 Schema 要求传入；
- `.env` 未生效：确认当前工作目录存在 `.env` 且可读；
- 优先级与预期不符：确认是否通过环境变量覆盖了配置文件。
