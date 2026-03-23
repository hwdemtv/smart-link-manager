export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  licenseServerUrl: process.env.LICENSE_SERVER_URL ?? "",
  defaultAdminUsername: process.env.DEFAULT_ADMIN_USERNAME ?? "admin",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD ?? "admin123",
  registrationDisabled: process.env.REGISTRATION_DISABLED === 'true',
};
