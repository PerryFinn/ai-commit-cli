import { log } from "@clack/prompts";
import pc from "picocolors";
import { runCLI } from "./cli/parser";
import { checkLatestVersion } from "./utils/check-is-latest-version";

async function main() {
  try {
    await checkLatestVersion();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.info(pc.yellow(`版本检查失败，已跳过：${message}`));
  }
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
