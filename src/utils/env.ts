import fs from "node:fs";
import { dirname, join } from "pathe";
import { getRepoRoot } from "./git";

/**
 * 环境变量键值映射
 */
export type EnvMap = Record<string, string>;

/**
 * 规范化环境变量名：去空格->大写->保留 A-Z0-9_
 */
export const normalizeEnvKey = (name: string): string =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");

/**
 * 校验环境变量名是否合法（兼容 POSIX 约定）
 */
export const isValidEnvKey = (name: string): boolean => /^[A-Z_][A-Z0-9_]*$/.test(name);

/**
 * 合并多个环境变量源，后者优先级更高
 */
export const mergeEnvVars = (sources: EnvMap[]): EnvMap => {
  const result: EnvMap = {};
  for (const src of sources) {
    for (const [k, v] of Object.entries(src)) {
      result[k] = v;
    }
  }
  return result;
};

/**
 * 查找当前工作目录下的 .env 文件
 */
export const findEnvFile = (startDir: string): string | undefined => {
  // 1) 优先使用 Git 获取仓库根
  const repoRoot = getRepoRoot(startDir);
  if (repoRoot) {
    const envAtRoot = join(repoRoot, ".env");
    if (fs.existsSync(envAtRoot) && fs.statSync(envAtRoot).isFile()) {
      return envAtRoot;
    }
    return undefined; // 成功定位仓库根但没有 .env，即认为不存在
  }

  // 2) 回退：从 startDir 向上查找（最多 20 层），在遇到仓库根（.git 或 package.json）或文件系统根时停止
  let currentDir = startDir;
  const isRepoRoot = (dir: string): boolean => {
    try {
      const hasGit = fs.existsSync(join(dir, ".git"));
      const hasPkg = fs.existsSync(join(dir, "package.json"));
      return hasGit || hasPkg;
    } catch {
      return false;
    }
  };

  for (let i = 0; i < 20; i++) {
    const envPath = join(currentDir, ".env");
    if (fs.existsSync(envPath) && fs.statSync(envPath).isFile()) {
      return envPath;
    }
    if (isRepoRoot(currentDir)) break; // 到达仓库根，停止继续向上
    const parent = dirname(currentDir);
    if (parent === currentDir) break; // 已到文件系统根
    currentDir = parent;
  }
  return undefined;
};

/**
 * 解析 .env 文件为键值映射（轻量解析器，不支持变量插值与多行值）
 */
export const loadEnvFile = (filePath: string): EnvMap => {
  const envMap: EnvMap = {};
  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`读取 .env 文件失败: ${String(error)}`);
  }

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue; // 注释或空行
    const exportPrefix = line.startsWith("export ") ? "export " : "";
    const lineWithoutExport = exportPrefix ? line.slice(7) : line;
    const eqIndex = lineWithoutExport.indexOf("=");
    if (eqIndex === -1) continue; // 非法行，忽略

    const rawKey = normalizeEnvKey(lineWithoutExport.slice(0, eqIndex));
    const rawValue = lineWithoutExport.slice(eqIndex + 1).trim();
    if (!isValidEnvKey(rawKey)) {
      throw new Error(`无效的环境变量名: ${rawKey}`);
    }

    let parsed = rawValue;
    // 处理引号包裹的值
    if ((parsed.startsWith('"') && parsed.endsWith('"')) || (parsed.startsWith("'") && parsed.endsWith("'"))) {
      parsed = parsed.slice(1, -1);
    }
    // 处理转义换行和 \n
    parsed = parsed.replace(/\\n/g, "\n");

    envMap[rawKey] = parsed;
  }
  return envMap;
};
