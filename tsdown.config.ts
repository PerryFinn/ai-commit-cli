import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Options } from "tsdown";

// 计算项目根与 src 绝对路径，供 alias 使用（避免相对路径在打包时被当作裸模块）
const rootDir = path.dirname(fileURLToPath(new URL("./", import.meta.url)));
const srcDir = path.join(rootDir, "src");

// 生成 changeset 相关的构建配置
const genChangesetConfig = (): Omit<Options, "config" | "filter"> => {
  const enableChangesetBuild = process.env.ENABLE_CHANGESET_BUILD === "true";
  if (!enableChangesetBuild) return {};

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

export default defineConfig([
  {
    entry: {
      index: "src/index.ts"
    },
    format: ["cjs", "esm"],
    dts: true,
    sourcemap: true,
    outDir: "dist",
    clean: true,
    minify: false,
    target: "es2020",
    alias: {
      "@": srcDir
    }
    // 把 js 和 cjs 格式的 dts 扩展名都固定成 .d.ts（防止产出 .d.cts和 .d.ts 两种类型文件）
    // outExtensions: ({ format }) => ({
    //   js: format === "cjs" ? ".cjs" : ".js",
    //   dts: ".d.ts"
    // })
  },
  genChangesetConfig()
]);
