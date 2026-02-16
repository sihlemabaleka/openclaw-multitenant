import { describe, expect, test } from "vitest";
import type { OpenClawConfig } from "./types.js";
import { resolveTelegramToken } from "../telegram/token.js";

describe("Tenant BYOC Configuration", () => {
  describe("Telegram BYOC", () => {
    test("reads botToken from account config", () => {
      const config: OpenClawConfig = {
        channels: {
          telegram: {
            accounts: {
              tenant1: {
                botToken: "1234567890:ABCdefTenant1Token",
                enabled: true,
              },
              tenant2: {
                botToken: "9876543210:XYZabcTenant2Token",
                enabled: true,
              },
            },
          },
        },
      };

      const tenant1Token = resolveTelegramToken(config, { accountId: "tenant1" });
      const tenant2Token = resolveTelegramToken(config, { accountId: "tenant2" });

      expect(tenant1Token.token).toBe("1234567890:ABCdefTenant1Token");
      expect(tenant1Token.source).toBe("config");

      expect(tenant2Token.token).toBe("9876543210:XYZabcTenant2Token");
      expect(tenant2Token.source).toBe("config");
    });

    test("falls back to global config for default account", () => {
      const config: OpenClawConfig = {
        channels: {
          telegram: {
            botToken: "1111111111:GlobalDefaultToken",
          },
        },
      };

      const defaultToken = resolveTelegramToken(config, { accountId: "default" });

      expect(defaultToken.token).toBe("1111111111:GlobalDefaultToken");
      expect(defaultToken.source).toBe("config");
    });

    test("falls back to env for default account when no config", () => {
      const config: OpenClawConfig = {
        channels: {
          telegram: {},
        },
      };

      const envToken = resolveTelegramToken(config, {
        accountId: "default",
        envToken: "9999999999:EnvToken",
      });

      expect(envToken.token).toBe("9999999999:EnvToken");
      expect(envToken.source).toBe("env");
    });

    test("tenant-specific token takes precedence over global", () => {
      const config: OpenClawConfig = {
        channels: {
          telegram: {
            botToken: "0000000000:GlobalToken",
            accounts: {
              tenant1: {
                botToken: "1111111111:TenantToken",
                enabled: true,
              },
            },
          },
        },
      };

      const tenantToken = resolveTelegramToken(config, { accountId: "tenant1" });

      expect(tenantToken.token).toBe("1111111111:TenantToken");
      expect(tenantToken.source).toBe("config");
    });
  });

  describe("WhatsApp BYOC", () => {
    test("supports per-tenant authDir configuration", () => {
      const config: OpenClawConfig = {
        channels: {
          whatsapp: {
            accounts: {
              tenant1: {
                authDir: "/home/node/.openclaw/whatsapp/tenant1",
                enabled: true,
              },
              tenant2: {
                authDir: "/home/node/.openclaw/whatsapp/tenant2",
                enabled: true,
              },
            },
          },
        },
      };

      const tenant1Auth = config.channels?.whatsapp?.accounts?.tenant1?.authDir;
      const tenant2Auth = config.channels?.whatsapp?.accounts?.tenant2?.authDir;

      expect(tenant1Auth).toBe("/home/node/.openclaw/whatsapp/tenant1");
      expect(tenant2Auth).toBe("/home/node/.openclaw/whatsapp/tenant2");
    });
  });

  describe("Slack BYOC", () => {
    test("supports per-tenant bot and app tokens", () => {
      const config: OpenClawConfig = {
        channels: {
          slack: {
            accounts: {
              tenant1: {
                botToken: "xoxb-tenant1-bot-token",
                appToken: "xapp-tenant1-app-token",
                enabled: true,
              },
              tenant2: {
                botToken: "xoxb-tenant2-bot-token",
                appToken: "xapp-tenant2-app-token",
                enabled: true,
              },
            },
          },
        },
      };

      const tenant1Bot = config.channels?.slack?.accounts?.tenant1?.botToken;
      const tenant1App = config.channels?.slack?.accounts?.tenant1?.appToken;
      const tenant2Bot = config.channels?.slack?.accounts?.tenant2?.botToken;
      const tenant2App = config.channels?.slack?.accounts?.tenant2?.appToken;

      expect(tenant1Bot).toBe("xoxb-tenant1-bot-token");
      expect(tenant1App).toBe("xapp-tenant1-app-token");
      expect(tenant2Bot).toBe("xoxb-tenant2-bot-token");
      expect(tenant2App).toBe("xapp-tenant2-app-token");
    });
  });

  describe("Multi-tenant isolation", () => {
    test("different tenants have isolated configurations", () => {
      const config: OpenClawConfig = {
        channels: {
          telegram: {
            accounts: {
              acme: {
                botToken: "1111:AcmeBot",
                enabled: true,
                allowFrom: ["*"],
                dmPolicy: "open",
              },
              globex: {
                botToken: "2222:GlobexBot",
                enabled: true,
                allowFrom: ["12345", "67890"],
                dmPolicy: "allowlist",
              },
            },
          },
          slack: {
            accounts: {
              acme: {
                botToken: "xoxb-acme",
                appToken: "xapp-acme",
                enabled: true,
              },
              globex: {
                botToken: "xoxb-globex",
                appToken: "xapp-globex",
                enabled: true,
              },
            },
          },
        },
      };

      // Verify Telegram isolation
      const acmeTgToken = resolveTelegramToken(config, { accountId: "acme" });
      const globexTgToken = resolveTelegramToken(config, { accountId: "globex" });

      expect(acmeTgToken.token).toBe("1111:AcmeBot");
      expect(globexTgToken.token).toBe("2222:GlobexBot");

      const acmeTgConfig = config.channels?.telegram?.accounts?.acme;
      const globexTgConfig = config.channels?.telegram?.accounts?.globex;

      expect(acmeTgConfig?.dmPolicy).toBe("open");
      expect(globexTgConfig?.dmPolicy).toBe("allowlist");

      // Verify Slack isolation
      const acmeSlack = config.channels?.slack?.accounts?.acme;
      const globexSlack = config.channels?.slack?.accounts?.globex;

      expect(acmeSlack?.botToken).toBe("xoxb-acme");
      expect(globexSlack?.botToken).toBe("xoxb-globex");
    });
  });
});
