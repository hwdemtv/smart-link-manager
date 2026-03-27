import {
  router,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "../_core/trpc";
import { z } from "zod";
import { getSystemConfig, updateSystemConfig } from "../db";
import { ENV } from "../_core/env";

export const configsRouter = router({
  getConfig: publicProcedure.query(async () => {
    const dbValue = await getSystemConfig("registrationDisabled");
    const defaultDomain = (await getSystemConfig("defaultDomain")) || "";
    const defaultShareSuffix =
      (await getSystemConfig("defaultShareSuffix")) || "";

    return {
      registrationDisabled:
        dbValue !== undefined ? Boolean(dbValue) : ENV.registrationDisabled,
      defaultDomain: String(defaultDomain),
      defaultShareSuffix: String(defaultShareSuffix),
    };
  }),

  updateRegistrationConfig: adminProcedure
    .input(
      z.object({
        disabled: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      await updateSystemConfig("registrationDisabled", input.disabled);
      return { success: true };
    }),

  updateDefaultDomainConfig: adminProcedure
    .input(
      z.object({
        domain: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const domainToSave = input.domain?.trim() || "";
      await updateSystemConfig("defaultDomain", domainToSave);
      return { success: true, domain: domainToSave };
    }),

  updateDefaultShareSuffixConfig: adminProcedure
    .input(
      z.object({
        suffix: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const suffixToSave = input.suffix?.trim() || "";
      await updateSystemConfig("defaultShareSuffix", suffixToSave);
      return { success: true, suffix: suffixToSave };
    }),

  getAiConfig: adminProcedure.query(async () => {
    const dbConfigValue = await getSystemConfig("aiConfig");
    let config = {
      provider: "openai",
      baseUrl: process.env.FORGE_API_URL || "",
      apiKey: "",
      model: "gpt-4o",
      temperature: 0.3,
    };

    if (dbConfigValue) {
      try {
        const dbConfig =
          typeof dbConfigValue === "string"
            ? JSON.parse(dbConfigValue)
            : dbConfigValue;
        config = { ...config, ...dbConfig };
      } catch (e) {
        console.error("Failed to parse AI config from DB", e);
      }
    }

    // Mask API Key for security
    if (config.apiKey && config.apiKey.length > 8) {
      config.apiKey = `${config.apiKey.substring(0, 3)}...${config.apiKey.substring(config.apiKey.length - 4)}`;
    }

    return config;
  }),

  updateAiConfig: adminProcedure
    .input(
      z.object({
        provider: z.string().default("openai"),
        baseUrl: z.string().optional(),
        apiKey: z.string().optional(),
        model: z.string().default("gpt-4o"),
        temperature: z.number().min(0).max(2).default(0.3),
      })
    )
    .mutation(async ({ input }) => {
      // Read existing config to preserve unchanged fields
      const dbConfigStr = await getSystemConfig("aiConfig");
      let currentConfig: any = {};
      if (dbConfigStr) {
        try {
          currentConfig = JSON.parse(dbConfigStr);
        } catch (e) {
          console.error("Failed to parse existing AI config", e);
        }
      }

      const newConfig = {
        provider: input.provider,
        baseUrl: input.baseUrl || currentConfig.baseUrl || "",
        model: input.model,
        temperature: input.temperature,
        // Only update apiKey if provided (not masked)
        apiKey:
          input.apiKey && !input.apiKey.includes("...")
            ? input.apiKey
            : currentConfig.apiKey || "",
      };

      await updateSystemConfig("aiConfig", JSON.stringify(newConfig));
      return { success: true };
    }),
});
