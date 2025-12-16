import cl100k_base from "@dqbd/tiktoken/encoders/cl100k_base.json";
import { Tiktoken } from "@dqbd/tiktoken/lite";

/**
 * 估算 prompt 的 token 数量（粗略估计）
 * 用于在发送前检查是否超出限制
 */
export const tokenCount = (content?: string): number => {
  if (!content) return 0;
  const encoding = new Tiktoken(cl100k_base.bpe_ranks, cl100k_base.special_tokens, cl100k_base.pat_str);
  const tokens = encoding.encode(content);
  encoding.free();
  return tokens.length;
};
