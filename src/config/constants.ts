import { type ConfigSchema, Language, LLMProvider } from "@/types/config";

export const DEFAULT_CONFIG: Partial<ConfigSchema> = {
  AIGCM_LLM_PROVIDER: LLMProvider.OPEN_AI,
  AIGCM_LANGUAGE: Language.zh_CN,
  AIGCM_ONE_LINE_COMMIT: false,
  AIGCM_MAX_TOKEN_INPUT: 4096,
  AIGCM_MAX_TOKEN_OUTPUT: 5000,
  AIGCM_MODEL_ID: "gpt-4o-mini"
};
