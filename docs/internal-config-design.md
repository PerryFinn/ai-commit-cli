# 内置配置存储设计

## 1. 背景与目标

本设计用于为 `ai-commit-cli` 引入一套**仅供内部使用、对用户不可见**的配置/状态存储能力（下文简称“内置配置”）。

现有的配置系统主要面向用户，可通过以下方式读写：

- `aigcm config set/get/ls/validate` 子命令；
- `.env` 文件；
- 运行时环境变量（`process.env`）。

这些配置都属于**“用户显式可感知的行为与参数”**，而本设计要解决的是另外一类需求：

- 需要在 CLI 内部持久化一些**运行状态或偏好**，例如：
  - 版本检查的上次成功时间，用于节流；
  - 当前用户+设备维度的匿名标识（`clientId`），用于统计或错误聚合；
  - 遥测同意状态（`telemetryConsent`）。
- 这些状态：
  - 不应该在 `config ls` 中展示；
  - 不需要、甚至不希望被环境变量或 `.env` 覆盖；
  - 只由内部模块读写，用户无需直接操作。

**目标：**

- **解耦** 用户可见配置（业务参数）与内置状态（运行时元数据）；
- 提供一个**简单、稳定、可扩展**的内置配置存储，复用现有 `conf` 能力；
- 能够在不破坏向后兼容的前提下，逐步增加新的内置字段（通过 `schemaVersion` 迁移）；
- 保证卸载/重装 CLI 后，只要未删除 `~/.aigcm` 目录，内置配置仍保持不变。

**非目标：**

- 不通过 CLI 提供任何 debug/internal 子命令（例如 `aigcm internal ls` 之类）；
- 不在内置配置中保存 API Key 等敏感凭据；
- 不在 README 或 `AGENTS.md` 中显式引用本设计文档，仅在 `docs/` 下供维护者查阅。

---

## 2. 与现有配置系统的关系

### 2.1 现有配置系统概览

现有配置相关模块：

- `src/types/config.ts`
  - 定义 `ConfigSchema`、`CONFIG_KEYS` 与 JSON Schema 属性 `configProperties`；
- `src/config/config-manager.ts`
  - 基于 `conf` 持久化用户配置，路径为 `~/.aigcm/config.json`（由 `projectName + cwd + configName` 决定）；
  - 三层优先级：
    1. CLI 注入的环境变量（`cliEnv`）；
    2. `.env` 文件；
    3. `conf` 持久化存储；
- `src/config/config-validator.ts`
  - 跨配置项的业务规则校验；
- `src/cli/commands/config.ts`
  - `config set/get/ls/validate` 子命令的实现。

### 2.2 与内置配置的边界

内置配置与现有配置的关系可以抽象为：

- **用户配置（User Config）**
  - 面向用户；
  - 通过 `config` 子命令、`.env`、环境变量读写；
  - 影响 CLI 对外可见行为（模型、Provider、语言等）。
- **内置配置（Internal Config）**
  - 面向 CLI 实现本身；
  - 仅通过内部模块读写，不暴露 CLI 命令；
  - 只存放运行时元数据，不影响业务逻辑的显式参数选择。

文字版架构示意：

```text
          +------------------------+
          |   User-facing Config   |
          |  (ConfigManager 等)    |
          +-----------+------------+
                      |
        config set/get/ls/validate, .env, env
                      |
        +-------------v---------------+
        |    用户配置文件 config.json  |
        |   (~/.aigcm/config.json)    |
        +-----------------------------+

        +-----------------------------+
        |   内置配置 Internal Config  |
        | (InternalConfigManager 等)  |
        +-------------+---------------+
                      |
          仅内部模块直接调用 get/set
                      |
        +-------------v---------------+
        |  内置配置文件 internal.json |
        |   (~/.aigcm/internal.json)  |
        +-----------------------------+
```

边界约束：

- `CONFIG_KEYS` 中**不包含**任何内置配置字段；
- `config` 子命令**不读取/不修改**内置配置；
- 内置配置不参与现有的优先级合并逻辑（`cliEnv` / `.env` / `conf`）。

---

## 3. 存储层与隔离策略设计

### 3.1 存储技术选型

继续使用 `conf` 作为内置配置的存储层，原因：

- 项目已经依赖 `conf`，额外心智负担较小；
- `conf` 支持基于 JSON Schema 的类型校验，与现有 `ConfigManager` 一致；
- 默认将配置文件存储在用户主目录下，便于在 CLI 升级/重装后保持配置持久化。

### 3.2 存储参数

内置配置实例的建议配置：

- `projectName: "ai-commit-cli"`
- `configName: "internal"`
- `cwd: join(homedir(), ".aigcm")`

由此得到的物理文件路径为：

- `~/.aigcm/internal.json`

与现有用户配置文件形成并行：

- `~/.aigcm/config.json`（用户配置）
- `~/.aigcm/internal.json`（内置配置）

### 3.3 隔离策略

- **不读取 `.env`**：内置配置只从 `conf` 持久化存储读取，不从 `.env` 或环境变量加载值；
- **不接受 CLI 注入 env**：不像 `ConfigManager` 一样接受 `cliEnv` 注入，避免被运行时环境覆盖；
- **不暴露路径给用户**：CLI 输出中不打印 `~/.aigcm/internal.json` 的完整路径，最多用于 debug 日志（仅在开发环境启用）；
- **不挂载 CLI 命令**：不提供 `aigcm internal ...` 形式的命令入口，防止用户误操作。

---

## 4. 内置配置 Schema 设计

内置配置 Schema 尽量保持精简，仅包含当前确实需要的字段。

### 4.1 InternalConfigSchema 字段

建议定义接口 `InternalConfigSchema`（仅作为设计文档示意，具体实现可放在 `src/config/internal-types.ts`）：

```ts
export interface InternalConfigSchema {
  /** 内置配置结构版本号，用于迁移控制 */
  schemaVersion?: number;
  /** 匿名 clientId：当前用户+设备维度的稳定标识 */
  clientId?: string;
  /** 上次成功执行版本检查的时间戳（ms） */
  lastVersionCheckAt?: number;
  /** 遥测同意状态：true/false 表示用户已选择，undefined 表示未选择 */
  telemetryConsent?: boolean;
}
```

字段说明表：

| 字段名               | 类型      | 默认值       | 必填 | 说明                                                                      |
| -------------------- | --------- | ------------ | ---- | ------------------------------------------------------------------------- |
| `schemaVersion`      | `number`  | `1`          | 否   | 内置配置结构版本号，用于判断是否需要迁移。                                |
| `clientId`           | `string`  | 无（懒生成） | 否   | 当前用户+设备维度的匿名标识，首次访问时生成 UUID 并持久化。               |
| `lastVersionCheckAt` | `number`  | 无           | 否   | 上次版本检查成功时间，毫秒时间戳；为空表示从未检查或记录已丢失。          |
| `telemetryConsent`   | `boolean` | 无           | 否   | 遥测同意状态；`true/false` 表示用户已明确选择，`undefined` 表示尚未询问。 |

### 4.2 设计原则

- **最小必要原则**：仅存储当前已确定有价值的字段；
- **与业务配置解耦**：不与 `AIGCM_*` 业务配置混合，避免用户误解；
- **可扩展性**：通过 `schemaVersion` 支持未来新增字段或语义变更；

---

## 5. 访问层 API 设计

### 5.1 InternalConfigManager 职责

新增 `InternalConfigManager`（建议路径：`src/config/internal-config-manager.ts`），其职责：

- 封装基于 `conf` 的读写逻辑；
- 对内置字段做最基本的类型校验；
- 在加载时执行 `schemaVersion` 相关的迁移；
- 提供简单易用的 `get/set/delete/getAll` API 给内部模块使用。

### 5.2 类型与方法（伪代码）

为保持与 `ConfigManager` 一致，可以复用或单独定义一个 `ValueWithSource` 类型：

```ts
type InternalSourceTag = 'internal';

export interface InternalValueWithSource<T> {
  value: T | undefined;
  source: InternalSourceTag | undefined; // 目前仅 "internal" 一种
}

export type InternalConfigKey = keyof InternalConfigSchema;
```

`InternalConfigManager` 伪代码：

```ts
export class InternalConfigManager {
  readonly #store: Conf<InternalConfigSchema>;

  constructor(params?: { projectDir?: string }) {
    this.#store = new Conf<InternalConfigSchema>({
      projectName: 'ai-commit-cli',
      cwd: join(homedir(), '.aigcm'),
      configName: 'internal',
      // 默认写入 schemaVersion，其他字段默认留空
      defaults: { schemaVersion: 1 },
    });

    this.migrateIfNeeded();
  }

  public get<K extends InternalConfigKey>(
    key: K
  ): InternalValueWithSource<InternalConfigSchema[K]> {
    if (this.#store.has(key)) {
      return {
        value: this.#store.get(key) as InternalConfigSchema[K],
        source: 'internal',
      };
    }
    return { value: undefined, source: undefined };
  }

  public set<K extends InternalConfigKey>(
    key: K,
    value: InternalConfigSchema[K]
  ): void {
    // 这里可以按需加入简单的类型校验，例如 schemaVersion 为非负整数等
    this.#store.set(key, value as never);
  }

  public delete<K extends InternalConfigKey>(key: K): void {
    this.#store.delete(key);
  }

  public getAll(): Record<InternalConfigKey, InternalValueWithSource<unknown>> {
    const result = {} as Record<
      InternalConfigKey,
      InternalValueWithSource<unknown>
    >;
    for (const key of Object.keys(this.#store.store) as InternalConfigKey[]) {
      result[key] = { value: this.#store.get(key), source: 'internal' };
    }
    return result;
  }

  private migrateIfNeeded(): void {
    // 见下文“版本与迁移机制”章节
  }
}
```

说明：

- `getAll` 主要用于内部调试和测试，不会通过 CLI 暴露；
- 与 `ConfigManager` 不同，`InternalConfigManager`：
  - 不接受 `cliEnv`；
  - 不读取 `.env`；
  - 不实现复杂的优先级逻辑。

---

## 6. 默认值与懒加载策略

### 6.1 默认值策略

- `schemaVersion`
  - 默认值为 `1`，在 `conf` 初始化时即写入；
  - 后续版本升级时，可以根据该字段判断是否需要迁移。
- 其余字段（`clientId`、`lastVersionCheckAt`、`telemetryConsent`）
  - 默认均为 `undefined`，只在真正需要时写入；
  - 避免无意义的磁盘写入和字段膨胀。

### 6.2 clientId 懒加载

`clientId` 采用“首次访问即生成”的策略：

1. 调用方通过某个 helper（例如 `getOrCreateClientId(manager)`）获取 `clientId`；
2. `InternalConfigManager.get("clientId")`：
   - 若存在非空值，直接返回；
   - 若不存在：
     - 生成一个新的 UUID（例如使用 `crypto.randomUUID()`）；
     - 写入 `internal.json` 的 `clientId` 字段；
     - 返回该值。

伪代码示例：

```ts
export async function getOrCreateClientId(
  manager: InternalConfigManager
): Promise<string> {
  const { value } = manager.get('clientId');
  if (value) return value;

  const newId = crypto.randomUUID();
  manager.set('clientId', newId);
  return newId;
}
```

特性：

- 只要用户不删除 `~/.aigcm` 目录，`clientId` 在卸载/重装 CLI 后仍保持稳定；
- 不依赖任何系统硬件 ID，避免跨平台差异与隐私风险；
- 代表的是“per-user-per-device”的稳定标识。

### 6.3 lastVersionCheckAt 与 telemetryConsent

- `lastVersionCheckAt === undefined`
  - 表示从未成功执行过版本检查，或记录已丢失；
  - 调用方通常视为“需要执行一次检查”。
- `telemetryConsent`
  - `true`：用户明确同意开启遥测；
  - `false`：用户明确拒绝遥测；
  - `undefined`：尚未向用户询问（或旧版本未记该字段）。

---

## 7. 版本与迁移机制

### 7.1 schemaVersion 用途

- `schemaVersion` 表示 `InternalConfigSchema` 的版本号；
- 当内置配置字段发生兼容性变更（新增、重命名、语义改变）时，通过 `schemaVersion` 驱动迁移逻辑；
- 设计目标是：在用户升级 CLI 版本时，**自动完成必要的迁移，不影响运行**。

### 7.2 迁移流程示意

1. `InternalConfigManager` 在构造函数中读取当前存储的 `schemaVersion`：
   - 若字段不存在，则视为 `schemaVersion = 1`；
   - 若存在但小于当前代码期望版本，则触发迁移；
2. 根据版本差异调用迁移函数，例如：

```ts
private migrateIfNeeded(): void {
  const currentVersion = this.#store.get("schemaVersion") ?? 1;
  const targetVersion = 1; // 当前代码期望的版本

  if (currentVersion === targetVersion) return;

  if (currentVersion < 1) {
    // 预留：未来如有 v0 -> v1 的迁移逻辑
  }

  // 迁移完成后，更新 schemaVersion
  this.#store.set("schemaVersion", targetVersion as never);
}
```

3. 迁移过程应具备以下特性：
   - **幂等**：重复执行不会产生错误结果；
   - **尽量无损**：不随意删除未知字段，除非明确知道其已废弃；
   - **可回退**：即使迁移失败，原始数据仍尽量保持可读（不覆盖未完成写入）。

当前版本（v1）尚未引入具体迁移逻辑，但预留了扩展点。

---

## 8. 安全与隐私考虑

### 8.1 不存放敏感凭据

- 内置配置**不用于存储**：
  - API Key（例如 `AIGCM_API_KEY`）；
  - 第三方服务的 Token 或 Refresh Token；
  - 用户自定义的机密内容。
- 所有这类信息仍通过用户配置系统管理：
  - `.env` + `ConfigManager`；
  - 或未来引入的安全存储模块。

### 8.2 未来可能的敏感字段策略（不在本版实现）

如确有需要在内置配置中存放少量敏感信息，可考虑以下策略，但本设计暂不落地实现：

1. **系统安全存储集成**：
   - 例如集成 `keytar` 或系统 Keychain，将敏感值存放在安全存储中；
   - 内置配置仅保存引用 ID 或别名，而非明文值。
2. **字段级对称加密**：
   - 为特定字段（例如 `encryptedToken`）做对称加密；
   - 密钥来源需谨慎设计（不可硬编码在仓库中）。

### 8.3 文件权限与日志

- `~/.aigcm` 目录默认归当前用户所有，权限遵从操作系统/Node 默认行为；
- CLI 日志中：
  - 不打印完整路径 `~/.aigcm/internal.json`，避免泄漏用户目录结构；
  - 仅在开发模式或显式开启 debug 选项时，输出内部状态的 debug 日志；
  - 不打印 `clientId` 等字段的明文值到公共日志（如错误栈中）。

---

## 9. 典型使用场景与交互流程

### 9.1 场景一：版本检查节流

目标：避免每次运行 CLI 都访问远端版本检查接口，降低延迟与流量。

**流程（文字时序）：**

1. 业务模块请求“是否需要进行版本检查”：
   - 通过 `InternalConfigManager` 读取 `lastVersionCheckAt`；
2. 判断：
   - 若 `lastVersionCheckAt` 为空，视为需要检查；
   - 若距离当前时间超过预设阈值（例如 24 小时），也视为需要检查；
   - 否则跳过版本检查；
3. 执行版本检查：
   - 若成功，则更新 `lastVersionCheckAt = Date.now()`；
   - 若失败，可选择不更新，以便下次重试。

### 9.2 场景二：匿名 clientId

目标：为“当前用户+设备”生成一个稳定的匿名标识，用于日志聚合或统计。

**流程：**

1. 业务模块需要一个 `clientId`（例如在错误上报 payload 中加入）：
   - 调用 `getOrCreateClientId(manager)`；
2. 内部逻辑：
   - 读取 `clientId` 字段；
   - 若存在，则直接返回；
   - 若不存在：生成 UUID，写入内置配置，并返回；
3. 即使用户卸载/重装 CLI，只要未删除 `~/.aigcm`，该 `clientId` 仍保持不变。

### 9.3 场景三：遥测同意状态

目标：在未来若引入遥测功能时，提供一个简单的三态机制（未询问/同意/拒绝）。

**流程：**

1. 程序启动或首次需要发送遥测前：
   - 通过 `InternalConfigManager` 读取 `telemetryConsent`；
2. 判断：
   - `undefined`：尚未询问，可在合适时机（例如首次成功使用）提示用户选择；
   - `true`：允许发送遥测；
   - `false`：严格禁止发送遥测；
3. 当用户在交互中做出选择时：
   - 调用 `set("telemetryConsent", true/false)` 写入结果；
   - 后续运行中始终复用该值。

> 说明：当前版本中可以仅记录 `telemetryConsent`，并不一定要立刻实现完整的遥测系统。

---

## 10. 与现有模块的集成边界

### 10.1 可以依赖内置配置的模块

- 未来的版本检查模块（例如 `src/utils/version-check.ts`）；
- 未来的遥测/统计模块；
- 需要基于 `clientId` 做轻量分流或日志聚合的模块。

### 10.2 不应依赖内置配置的模块

- 普通业务逻辑模块，例如提交信息生成、配置读取等核心流程；
- 对外暴露的 SDK 接口，如果后续将 CLI 内核抽离为库使用；
- `src/cli/commands/config.ts` 以及其他用户配置相关命令。

### 10.3 CLI 行为约束

- 不在 CLI 中增加 `internal` 相关子命令；
- 不在现有 `config` 子命令输出中混入内置配置字段；
- 如有必要打印内部状态，仅在开发模式通过 debug 日志输出，并避免泄漏隐私信息。

---

## 11. 实现与测试建议

### 11.1 推荐实现步骤

1. **定义类型与 Schema**
   - 新增 `InternalConfigSchema`、`InternalConfigKey` 等类型（例如放在 `src/config/internal-types.ts`）；
   - 视需要为 `schemaVersion` 等字段增加简单的运行时校验逻辑。
2. **实现 InternalConfigManager**
   - 在 `src/config/internal-config-manager.ts` 中封装基于 `conf` 的读写与迁移逻辑；
   - 提供 `get/set/delete/getAll` 方法；
   - 在构造函数中调用 `migrateIfNeeded()`。
3. **接入典型场景**
   - 在版本检查逻辑中使用 `lastVersionCheckAt`；
   - 在日志/错误上报中使用 `clientId`（如需要）；
   - 在未来的遥测模块中使用 `telemetryConsent`。

### 11.2 测试用例建议

- **读写基本行为**：
  - `set` 后 `get` 能够读到正确值；
  - `delete` 后 `get` 返回 `undefined`；
- **懒加载 clientId**：
  - 初次调用 `getOrCreateClientId` 时会生成新 UUID，并写入存储；
  - 后续多次调用返回相同的值；
- **schemaVersion 迁移**：
  - 构造一个旧版本的 `internal.json`（缺少 `schemaVersion` 或值为较小版本），验证 `migrateIfNeeded` 能正确升级；
  - 迁移逻辑对未知字段保持兼容，不会造成数据损坏；
- **隔离性**：
  - 在测试环境中使用临时目录作为 `cwd`，确保不会污染真实 `~/.aigcm`；
  - 验证内置配置的读写不会影响现有用户配置文件 `config.json`。

### 11.3 调试建议

- 为 `InternalConfigManager` 增加可选的 debug 选项（仅在代码内部使用），例如：
  - 接受 `debug?: boolean` 或自定义 logger；
  - 在 debug 模式下输出读写 key 及迁移信息；
- 在单测中通过注入 mock logger 验证关键行为，而不是依赖真实 stdout。

---

## 12. 文档与维护

- 本设计文档文件名为：`docs/internal-config-design.md`；
- 文档受众为项目维护者和贡献者，帮助理解内置配置的存在及演进方式；
- 不在 README 或 `AGENTS.md` 中添加额外引用，但建议在需要改动内置配置时优先查阅本文件；
- 当未来对 `InternalConfigSchema` 做破坏性变更时，应同步更新本设计文档中的字段表与迁移章节。
