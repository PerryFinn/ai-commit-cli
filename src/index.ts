import { cancel, intro, isCancel, outro, select, text } from "@clack/prompts";
import mri from "mri";
import color from "picocolors";
import { name as packageName } from "../package.json";

const argv = mri<{
  template?: string;
  help?: boolean;
  overwrite?: boolean;
}>(process.argv.slice(2), {
  alias: { h: "help", t: "template" },
  boolean: ["help", "overwrite"],
  string: ["template"]
});

console.log("argv :>> ", argv);

const cwd = process.cwd();

async function main() {
  intro(color.inverse(packageName));

  const name = await text({
    message: "What is your name?",
    placeholder: "Anonymous"
  });
  if (isCancel(name)) {
    cancel("Operation cancelled");
    return process.exit(0);
  }

  const projectType = await select({
    message: "Pick a project type.",
    options: [
      { value: "ts", label: "TypeScript" },
      { value: "js", label: "JavaScript" },
      { value: "coffee", label: "CoffeeScript", hint: "oh no" }
    ]
  });

  if (isCancel(projectType)) {
    cancel("Operation cancelled");
    return process.exit(0);
  }

  outro(color.inverse(packageName));
}

main();

process.on("uncaughtException", (error) => {
  if (error instanceof Error && error.name === "ExitPromptError") {
    console.log("👋 See you next time!");
  } else {
    // Rethrow unknown errors
    throw error;
  }
});
