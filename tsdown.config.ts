import { defineConfig, type Options } from "tsdown";

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
    target: "es2020"
    // 把 js 和 cjs 格式的 dts 扩展名都固定成 .d.ts（防止产出 .d.cts和 .d.ts 两种类型文件）
    // outExtensions: ({ format }) => ({
    //   js: format === "cjs" ? ".cjs" : ".js",
    //   dts: ".d.ts"
    // })
  },
  genChangesetConfig()
]);
