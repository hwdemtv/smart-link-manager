DROP TABLE `subscription_change_requests`;--> statement-breakpoint
DROP TABLE `subscription_plans`;--> statement-breakpoint
DROP TABLE `subscriptions`;--> statement-breakpoint
DROP TABLE `tenant_configs`;--> statement-breakpoint
DROP TABLE `tenants`;--> statement-breakpoint
ALTER TABLE `api_keys` DROP FOREIGN KEY `api_keys_tenantId_tenants_id_fk`;
--> statement-breakpoint
ALTER TABLE `domains` DROP FOREIGN KEY `domains_tenantId_tenants_id_fk`;
--> statement-breakpoint
ALTER TABLE `links` DROP FOREIGN KEY `links_tenantId_tenants_id_fk`;
--> statement-breakpoint
ALTER TABLE `notifications` DROP FOREIGN KEY `notifications_tenantId_tenants_id_fk`;
--> statement-breakpoint
ALTER TABLE `usage_logs` DROP FOREIGN KEY `usage_logs_tenantId_tenants_id_fk`;
--> statement-breakpoint
ALTER TABLE `users` DROP FOREIGN KEY `users_tenantId_tenants_id_fk`;
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `usage_logs` ADD `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionTier` varchar(50) DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `licenseKey` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `licenseExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `licenseToken` text;--> statement-breakpoint
ALTER TABLE `usage_logs` ADD CONSTRAINT `usage_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_keys` DROP COLUMN `tenantId`;--> statement-breakpoint
ALTER TABLE `audit_logs` DROP COLUMN `tenantId`;--> statement-breakpoint
ALTER TABLE `domains` DROP COLUMN `tenantId`;--> statement-breakpoint
ALTER TABLE `links` DROP COLUMN `tenantId`;--> statement-breakpoint
ALTER TABLE `notifications` DROP COLUMN `tenantId`;--> statement-breakpoint
ALTER TABLE `usage_logs` DROP COLUMN `tenantId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `tenantId`;