import pc from "picocolors";

// 使用 picocolors，根据不同的数据类型，显示不同的颜色
export const colorize = (value: string | number | boolean | undefined | null) => {
  const valueStr = String(value);
  if (value === null) return pc.dim(valueStr);
  if (typeof value === "undefined") return pc.dim(valueStr);

  const type = typeof value;
  switch (type) {
    case "string":
      return pc.green(valueStr);
    case "number":
      return pc.blue(valueStr);
    case "boolean":
      return pc.yellow(valueStr);
    default:
      return valueStr;
  }
};
