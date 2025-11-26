# 技术设计问题清单

本文档记录代码审查中发现的技术设计问题，按优先级分类并提供改进建议。

## 架构优点 ✅

1. **配置优先级设计合理**：CLI env → .env → config store 的三层优先级清晰且符合实际使用场景
2. **类型安全完善**：使用 `as const` 替代 `enum`，充分利用 TypeScript 类型推断能力
3. **持久化方案成熟**：使用 `conf` 库避免手动文件操作，内置 JSON Schema 校验
4. **测试策略完整**：覆盖单元测试、集成测试与未来的 E2E 测试

## 已识别的设计问题与改进建议

### ✅ 高优先级（P0 - 已解决）

#### 1. 环境变量过滤缺失 ✅ 已修复

- **原问题**：`cli/commands/config.ts` 中的 `normalizeCliEnv` 只过滤 `undefined` 值，未过滤 `AIGCM_` 前缀
- **解决方案**：在 `normalizeCliEnv` 中添加了前缀过滤逻辑
- **相关代码**：`src/cli/commands/config.ts` 第 80-88 行
- **测试覆盖**：`tests/cli/commands/config.test.ts` 中新增了 "应该过滤非 AIGCM\_ 前缀的环境变量" 测试

#### 2. 类型转换逻辑重复 ✅ 已修复

- **原问题**：`config.ts` 的 `coerceValueForKey` 与 `ConfigManager` 的 `castValue` 逻辑重复
- **解决方案**：
  1. 修改 `ConfigManager.set` 方法，支持接收 `string` 类型并自动转换
  2. 移除 CLI 层的 `coerceValueForKey` 函数，CLI 直接传递字符串
- **相关代码**：`src/config/config-manager.ts` 第 61-67 行
- **测试覆盖**：`tests/config/config-manager.test.ts` 中 "set 方法字符串转换" 测试套件

### 🟡 中优先级（P1 - 功能扩展时需考虑）

#### 3. Git 操作分散 ✅ 已修复

- **原问题**：`utils/env.ts` 中直接使用 `execaSync` 调用 `git` 命令
- **解决方案**：新增 `src/utils/git.ts` 统一封装 Git 操作
- **实现内容**：
  - `GitService` 类：提供 `getRepoRoot()`、`isInsideRepo()`、`getCurrentBranch()`、`getStagedFiles()`、`getStatus()`、`getStagedDiff()`、`getStagedDiffStat()`、`commit()`、`add()` 等方法
  - `getRepoRoot()` 便捷函数：供 `env.ts` 使用
  - 完整的类型定义：`GitFileStatus`、`StagedFile`、`GitStatus`
- **相关代码**：`src/utils/git.ts`
- **测试覆盖**：`tests/utils/git.test.ts`（21 个测试用例，使用临时 Git 仓库）

#### 4. 配置验证不足 ✅ 已修复

- **原问题**：ConfigManager 只做单字段类型校验，无法验证跨配置项的业务规则
- **解决方案**：引入 `ConfigValidator` 类
- **实现内容**：
  - 验证 Provider 依赖：Dify 需要 AUTH_ID，OpenAI/Gemini 需要 API_KEY
  - 验证 AI 提交生成所需配置：Provider、Model ID 等
  - 区分错误（阻止执行）和警告（建议配置）
  - 提供修复建议
- **相关代码**：`src/config/config-validator.ts`
- **CLI 命令**：`aigcm config validate`
- **测试覆盖**：`tests/config/config-validator.test.ts`（16 个测试用例）

#### 5. 错误处理粗糙 ✅ 已修复

- **原问题**：CLI 层直接 `catch` 错误后输出，未区分错误类型
- **解决方案**：定义错误类型层次结构
- **实现内容**：
  - `CLIError`：基础错误类，包含 code 和 suggestion
  - `ConfigError`：配置错误，包含 configKey
  - `NetworkError`：网络错误，包含 statusCode
  - `GitError`：Git 操作错误
  - `ValidationError`：验证错误，包含 field
  - `handleError()`：统一错误处理器，根据类型输出差异化信息
- **相关代码**：
  - `src/types/errors.ts`：错误类型定义
  - `src/cli/error-handler.ts`：统一错误处理器
- **测试覆盖**：`tests/types/errors.test.ts`（23 个测试用例）

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
已完成 ✅：
  └─ P0-1: 环境变量前缀过滤
  └─ P0-2: 移除 CLI 层类型转换逻辑
  └─ P1-3: 封装 GitService
  └─ P1-4: 实现配置验证器
  └─ P1-5: 定义错误类型层次

功能开发中：
  └─ P2-6: 定义 LLMProvider 接口
  └─ P2-7: 实现横切关注点处理
```

## 实施建议

### 第一阶段 ✅ 已完成

P0 问题已修复：

1. ✅ 修改 `cli/commands/config.ts` 的 `normalizeCliEnv` 添加前缀过滤
2. ✅ 重构 `ConfigManager.set` 支持字符串输入并自动转换
3. ✅ 移除 `coerceValueForKey` 函数
4. ✅ 更新相关测试确保覆盖率不降低

### 第二阶段（AI 功能开发前）

创建独立 PR 解决 P1 问题：

1. **PR1: Git 操作封装** ✅ 已完成

   - ✅ 创建 `src/utils/git.ts`
   - ✅ 迁移现有 Git 调用
   - ✅ 编写单元测试（21 个测试用例）

2. **PR2: 配置验证器** ✅ 已完成

   - ✅ 创建 `src/config/config-validator.ts`
   - ✅ 实现跨配置项验证规则
   - ✅ 添加 `config validate` 子命令
   - ✅ 编写单元测试（16 个测试用例）

3. **PR3: 错误类型层次** ✅ 已完成
   - ✅ 创建 `src/types/errors.ts`
   - ✅ 定义错误类型层次（CLIError、ConfigError、NetworkError、GitError、ValidationError）
   - ✅ 创建 `src/cli/error-handler.ts` 统一错误处理
   - ✅ 更新 ConfigManager 使用新错误类型
   - ✅ 编写单元测试（23 个测试用例）

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

最后更新：2025-11-26
