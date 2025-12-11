import type { JSONSchemaProperty } from "@/types/config";

export interface InternalConfigSchema {
  /** 内置配置结构版本号 */
  schemaVersion?: number;
  /** 匿名 clientId，用于 per-user-per-device 标识 */
  clientId?: string;
  /** 上次成功版本检查的时间戳（ms） */
  lastVersionCheckAt?: number;
  /** 遥测同意状态；undefined 表示未选择 */
  telemetryConsent?: boolean;
}

export const INTERNAL_CONFIG_KEYS = ["schemaVersion", "clientId", "lastVersionCheckAt", "telemetryConsent"] as const;

export type InternalConfigKey = (typeof INTERNAL_CONFIG_KEYS)[number];

export const INTERNAL_CONFIG_VERSION = 1;

export const INTERNAL_CONFIG_DEFAULTS: Partial<InternalConfigSchema> = {
  schemaVersion: INTERNAL_CONFIG_VERSION
};

export const internalConfigProperties: Record<InternalConfigKey, JSONSchemaProperty> = {
  schemaVersion: { type: "number", minimum: 1 },
  clientId: { type: "string" },
  lastVersionCheckAt: { type: "number", minimum: 0 },
  telemetryConsent: { type: "boolean" }
} as const;
