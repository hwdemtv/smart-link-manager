import { router } from "../_core/trpc";
import { systemRouter } from "../_core/systemRouter";
import { authRouter } from "./auth";
import { linksRouter } from "./links";
import { groupsRouter } from "./groups";
import { domainsRouter } from "./domains";
import { statsRouter } from "./stats";
import { adminRouter } from "./admin";
import { recycleBinRouter } from "./recycleBin";
import { configsRouter } from "./configs";
import { apiKeysRouter } from "./apiKeys";
import { userRouter } from "./user";
import { blacklistRouter } from "./blacklist";

// The unified application router
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  links: linksRouter,
  groups: groupsRouter,
  domains: domainsRouter,
  stats: statsRouter,
  admin: adminRouter,
  recycleBin: recycleBinRouter,
  configs: configsRouter,
  apiKeys: apiKeysRouter,
  user: userRouter,
  blacklist: blacklistRouter,
});

export type AppRouter = typeof appRouter;
