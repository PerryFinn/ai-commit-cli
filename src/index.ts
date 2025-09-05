import { add } from "./utils";

// 使用更具描述性的变量名
const sum = add(2, 2);

// 添加更多上下文信息到日志输出
console.log("计算结果:", sum);

// 可以添加类型注解提高代码可读性
const typedSum: number = add(2, 2);
console.log("带类型的计算结果:", typedSum);

// 可以添加错误处理
try {
  const safeSum = add(2, 2);
  console.log("安全的计算结果:", safeSum);
} catch (error) {
  console.error("计算出错:", error);
}

export type DemoType = {
  name: string;
};
