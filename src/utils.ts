/**
 * 通用字符串居中填充
 */
export const padCenter = (text: string, length: number, fill = " "): string => {
  if (text.length >= length) return text;
  const total = length - text.length;
  const left = Math.floor(total / 2);
  const right = total - left;
  return fill.repeat(left) + text + fill.repeat(right);
};

/**
 * 校验配置键名（必须为大写 + 数字 + 下划线, 首字符为字母或下划线）
 */
export const isValidConfigKey = (key: string): boolean => /^[A-Z_][A-Z0-9_]*$/.test(key);

/**
 * 统一错误消息生成
 */
export const formatErrorMessage = (message: string): string => `Error: ${message}`;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
