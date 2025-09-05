import type { UserConfig } from "@commitlint/types";

/**
 * 配置：https://commitlint.js.org/reference/configuration.html
 */

const commitlintConfiguration: UserConfig = {
  /*
   * Resolve and load @commitlint/config-conventional from node_modules.
   * Referenced packages must be installed
   */
  extends: ["@commitlint/config-conventional"],
  helpUrl: "https://github.com/conventional-changelog/commitlint/#what-is-commitlint"
};

export default commitlintConfiguration;
