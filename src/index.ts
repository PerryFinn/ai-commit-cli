import { log } from "@clack/prompts";
import pc from "picocolors";
import { runCLI } from "./cli/parser";
import { checkLatestVersion } from "./utils/check-is-latest-version";

async function main() {
  // 1. 检查最新版本
  await checkLatestVersion();

  // 2. 运行 CLI
  const code = await runCLI(process.argv.slice(2));
  process.exitCode = code;
}

main();

process.on("uncaughtException", (error) => {
  if (error instanceof Error && error.name === "ExitPromptError") {
    log.info(pc.yellow("👋 See you next time!"));
  } else {
    throw error;
  }
});
