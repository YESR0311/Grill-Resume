"use server";

import { testConnection } from "@/features/settings/test-connection";

export async function testConnectionAction(
  connectionId: string,
): Promise<{ ok: boolean; reply?: string; error?: string }> {
  return testConnection(connectionId);
}