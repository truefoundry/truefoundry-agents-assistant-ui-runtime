import { describe, expect, it } from "vitest";

import type { PermissionsServer } from "./types.js";

describe("PermissionsServer", () => {
  it("supports USE grants for agents", async () => {
    const server: PermissionsServer = {
      listPermissions: async () => ({ data: { agent: ["USE"] } }),
    };

    await expect(
      server.listPermissions({ resourceType: "agent", resourceIds: ["agent"] }),
    ).resolves.toEqual({ data: { agent: ["USE"] } });
  });
});
