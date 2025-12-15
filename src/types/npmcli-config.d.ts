// @npmcli/config 当前没有官方或 DefinitelyTyped 的类型发布，安装 @types/npmcli__config 会失败。
// 这里仅声明我们用到的最小 API，避免臆测完整定义，后续若官方提供类型可删除本文件。
declare module "@npmcli/config" {
  export interface ConfigOptions {
    definitions: Record<string, unknown>;
    shorthands: Record<string, unknown>;
    flatten: (src: Record<string, unknown>, dest: Record<string, unknown>) => void;
    cwd?: string;
    npmPath?: string;
    argv?: readonly string[];
    env?: NodeJS.ProcessEnv;
    execPath?: string;
    platform?: NodeJS.Platform;
  }

  export default class Config {
    constructor(options: ConfigOptions);
    load(): Promise<void>;
    get<T = unknown>(key: string, where?: string): T;
    get flat(): Record<string, unknown>;
  }
}

// 子路径同样无类型包，保留最小声明以支撑编译。
declare module "@npmcli/config/lib/definitions" {
  export const definitions: Record<string, unknown>;
  export const shorthands: Record<string, unknown>;
  export const flatten: (src: Record<string, unknown>, dest: Record<string, unknown>) => void;
}
