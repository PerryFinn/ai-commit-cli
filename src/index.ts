import { log } from "@clack/prompts";
import pc from "picocolors";
import { runCLI } from "./cli/parser";
import { checkLatestVersion } from "./utils/checkIsLatestVersion";

async function main() {
  // await checkLatestVersion();
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
