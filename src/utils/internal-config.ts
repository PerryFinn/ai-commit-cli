import { nanoid } from "nanoid";
import type { InternalConfigManager } from "@/config/internal-config-manager";

export function getOrCreateClientId(manager: InternalConfigManager): string {
  const { value } = manager.get("clientId");
  if (value) return value;

  const newId = nanoid();
  manager.set("clientId", newId);
  return newId;
}
