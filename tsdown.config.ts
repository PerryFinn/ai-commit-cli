import { fileURLToPath } from "node:url";
import { dirname, join } from "pathe";
import { defineConfig, type UserConfig } from "tsdown";

// 计算项目根与 src 绝对路径，供 alias 使用（避免相对路径在打包时被当作裸模块）
const rootDir = dirname(fileURLToPath(new URL("./", import.meta.url)));
const srcDir = join(rootDir, "src");

const commonConfig: UserConfig = {
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  outDir: "dist",
  clean: true,
  // 开启 tsdown 内置压缩，移除注释与多余空白
  minify: true,
  target: "es2020",
  alias: {
    "@": srcDir
  },
  // 把 js 和 cjs 格式的 dts 扩展名都固定成 .d.ts（防止产出 .d.cts和 .d.ts 两种类型文件）
  outExtensions: ({ format }) => ({
    js: format === "cjs" ? ".cjs" : ".js",
    dts: format === "cjs" ? ".d.cts" : ".d.ts"
  })
};

// 生成 changeset 相关的构建配置
const genChangesetConfig = (): UserConfig | null => {
  const enableChangesetBuild = process.env.ENABLE_CHANGESET_BUILD === "true";
  if (!enableChangesetBuild) return null;

  return {
    entry: {
      // 重新生成 changeset.commit.cjs 文件时需要
      "changeset.commit": "./scripts/changeset.commit.ts"
    },
    format: ["cjs"],
    sourcemap: true,
    outDir: ".changeset",
    clean: false,
    target: "node14"
  };
};

const genPackageConfig = (): UserConfig => {
  return {
    ...commonConfig,
    entry: {
      index: "src/index.ts"
    }
  };
};

const genCLIConfig = (): UserConfig => {
  return {
    ...commonConfig,
    entry: {
      cli: "src/index.ts"
    },
    format: ["cjs"],
    dts: false,
    banner: {
      js: `#!/usr/bin/env node`
    },
    platform: "node",
    copy: [{ from: "./node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm", to: "./dist/tiktoken_bg.wasm" }]
  };
};

export default defineConfig([genChangesetConfig(), genPackageConfig(), genCLIConfig()].filter(Boolean) as UserConfig[]);
