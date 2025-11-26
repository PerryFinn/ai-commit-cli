# 技术设计问题清单

本文档记录代码审查中发现的技术设计问题，按优先级分类并提供改进建议。

## 架构优点 ✅

1. **配置优先级设计合理**：CLI env → .env → config store 的三层优先级清晰且符合实际使用场景
2. **类型安全完善**：使用 `as const` 替代 `enum`，充分利用 TypeScript 类型推断能力
3. **持久化方案成熟**：使用 `conf` 库避免手动文件操作，内置 JSON Schema 校验
4. **测试策略完整**：覆盖单元测试、集成测试与未来的 E2E 测试

## 已识别的设计问题与改进建议

### 🔴 高优先级（P0 - 需要在功能扩展前解决）

#### 1. 环境变量过滤缺失

- **现状**：`cli/commands/config.ts` 中的 `normalizeCliEnv` 只过滤 `undefined` 值，未过滤 `AIGCM_` 前缀
- **问题**：将整个 `process.env` 传入 ConfigManager，可能导致意外行为
- **建议**：在 `normalizeCliEnv` 中添加前缀过滤逻辑

  ```typescript
  const normalizeCliEnv = (
    env: Record<string, string | undefined>
  ): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
      if (k.startsWith('AIGCM_') && typeof v === 'string') out[k] = v;
    }
    return out;
  };
  ```

#### 2. 类型转换逻辑重复

- **现状**：`config.ts` 的 `coerceValueForKey` 与 `ConfigManager` 的 `castValue` 逻辑重复
- **问题**：违反 DRY 原则，增加维护成本，CLI 层不应关心类型转换细节
- **建议**：移除 CLI 层的类型转换，统一由 ConfigManager 处理

  ```typescript
  // CLI 层直接传递字符串
  manager.set(key, value); // value 是 string
  // ConfigManager 内部负责类型转换与校验
  ```

- **实现步骤**：
  1. 修改 `ConfigManager.set` 方法，支持接收 `string` 类型并自动转换
  2. 移除 `cli/commands/config.ts` 中的 `coerceValueForKey` 函数
  3. 更新相关测试用例

### 🟡 中优先级（P1 - 功能扩展时需考虑）

#### 3. Git 操作分散

- **现状**：`utils/env.ts` 中直接使用 `execaSync` 调用 `git` 命令
- **问题**：难以测试，未来扩展 Git 操作时逻辑分散
- **建议**：新增 `src/utils/git.ts` 统一封装 Git 操作

  ```typescript
  export class GitService {
    getRepoRoot(): string | undefined {
      /* ... */
    }
    getDiff(options?: DiffOptions): string {
      /* ... */
    }
    getStatus(): GitStatus {
      /* ... */
    }
  }
  ```

- **重构步骤**：
  1. 创建 `src/utils/git.ts`，封装所有 Git 相关操作
  2. 将 `utils/env.ts` 中的 `git rev-parse` 调用迁移到 GitService
  3. 为 GitService 编写单元测试（使用临时 Git 仓库）
  4. 更新 `utils/env.ts` 使用 GitService

#### 4. 配置验证不足

- **现状**：ConfigManager 只做单字段类型校验
- **问题**：无法验证跨配置项的业务规则（如使用 Dify 时必需 `AIGCM_DIFY_AUTH_ID`）
- **建议**：引入配置验证器

  ```typescript
  export class ConfigValidator {
    validate(config: Partial<ConfigSchema>): ValidationResult {
      // 验证业务规则：如 provider=DIFY 时检查 authId
      if (config.AIGCM_LLM_PROVIDER === 'DIFY' && !config.AIGCM_DIFY_AUTH_ID) {
        return {
          valid: false,
          errors: ['使用 Dify 时必须配置 AIGCM_DIFY_AUTH_ID'],
        };
      }
      return { valid: true };
    }
  }
  ```

- **应用时机**：
  - 在 AI 提交生成命令初始化时调用验证
  - 提供 `aigcm config validate` 子命令供用户主动检查

#### 5. 错误处理粗糙

- **现状**：CLI 层直接 `catch` 错误后输出，未区分错误类型
- **问题**：难以对不同错误做差异化处理（如配置错误、网络错误、业务错误）
- **建议**：定义错误类型层次结构

  ```typescript
  export class CLIError extends Error {
    constructor(message: string, public readonly code: string) {
      super(message);
    }
  }
  export class ConfigError extends CLIError {
    /* ... */
  }
  export class NetworkError extends CLIError {
    /* ... */
  }
  export class ValidationError extends CLIError {
    /* ... */
  }
  ```

- **使用示例**：

  ```typescript
  try {
    // ...
  } catch (error) {
    if (error instanceof ConfigError) {
      log.error(pc.red(`配置错误: ${error.message}`));
      log.info(pc.yellow('提示: 使用 aigcm config ls 查看当前配置'));
    } else if (error instanceof NetworkError) {
      log.error(pc.red(`网络错误: ${error.message}`));
      log.info(pc.yellow('提示: 检查网络连接或 AIGCM_BASE_URL 配置'));
    } else {
      log.error(pc.red((error as Error).message));
    }
  }
  ```

### 🟢 低优先级（P2 - 优化项）

#### 6. LLM Provider 抽象未定义

- **建议**：在实现 AI 提交生成功能前，明确定义 Provider 接口

  ```typescript
  export interface LLMProvider {
    generate(prompt: string, options: GenerateOptions): Promise<GenerateResult>;
    validateConfig(config: Partial<ConfigSchema>): boolean;
  }

  // 实现示例
  export class OpenAIProvider implements LLMProvider {
    constructor(private config: ConfigSchema) {}

    async generate(
      prompt: string,
      options: GenerateOptions
    ): Promise<GenerateResult> {
      // 调用 OpenAI API
    }

    validateConfig(config: Partial<ConfigSchema>): boolean {
      return !!config.AIGCM_API_KEY && !!config.AIGCM_MODEL_ID;
    }
  }
  ```

- **目录结构建议**：

  ```text
  src/
    services/
      providers/
        base.ts          # LLMProvider 接口定义
        openai.ts        # OpenAIProvider 实现
        gemini.ts        # GeminiProvider 实现
        dify.ts          # DifyProvider 实现
        factory.ts       # Provider 工厂，根据配置创建对应实例
  ```

#### 7. 横切关注点缺失

- **建议**：为 LLM 调用添加统一的重试、超时、日志处理
- **方案**：使用装饰器模式或中间件模式实现

  ```typescript
  export class ProviderWithRetry implements LLMProvider {
    constructor(
      private provider: LLMProvider,
      private maxRetries: number = 3
    ) {}

    async generate(
      prompt: string,
      options: GenerateOptions
    ): Promise<GenerateResult> {
      let lastError: Error | undefined;
      for (let i = 0; i < this.maxRetries; i++) {
        try {
          return await this.provider.generate(prompt, options);
        } catch (error) {
          lastError = error as Error;
          if (i < this.maxRetries - 1) {
            await this.delay(Math.pow(2, i) * 1000); // 指数退避
          }
        }
      }
      throw lastError;
    }

    private delay(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  }
  ```

## 改进优先级总结

```text
立即修复（下一个 PR）：
  └─ P0-1: 环境变量前缀过滤
  └─ P0-2: 移除 CLI 层类型转换逻辑

功能扩展前（AI 提交生成前）：
  └─ P1-3: 封装 GitService
  └─ P1-4: 实现配置验证器
  └─ P1-5: 定义错误类型层次

功能开发中：
  └─ P2-6: 定义 LLMProvider 接口
  └─ P2-7: 实现横切关注点处理
```

## 实施建议

### 第一阶段（立即执行）

创建 PR 修复 P0 问题：

1. 修改 `cli/commands/config.ts` 的 `normalizeCliEnv` 添加前缀过滤
2. 重构 `ConfigManager.set` 支持字符串输入并自动转换
3. 移除 `coerceValueForKey` 函数
4. 更新相关测试确保覆盖率不降低

预计工作量：2-3 小时

### 第二阶段（AI 功能开发前）

创建独立 PR 解决 P1 问题：

1. **PR1: Git 操作封装**

   - 创建 `src/utils/git.ts`
   - 迁移现有 Git 调用
   - 编写单元测试

2. **PR2: 配置验证器**

   - 创建 `src/config/ConfigValidator.ts`
   - 实现跨配置项验证规则
   - 添加 `config validate` 子命令

3. **PR3: 错误类型层次**
   - 创建 `src/types/errors.ts`
   - 定义错误类型层次
   - 更新 CLI 层错误处理

预计工作量：每个 PR 3-4 小时

### 第三阶段（AI 功能开发中）

在实现 AI 提交生成功能时同步解决 P2 问题：

1. 定义 LLMProvider 接口
2. 实现各个 Provider
3. 添加重试、超时等横切关注点

预计工作量：集成在功能开发中，无需额外时间

## 相关文档

- [功能架构设计总览](./system-architecture.md)
- [配置管理系统设计](./config-management-design.md)
- [仓库协作指南](../AGENTS.md)

---

最后更新：2025-10-08
