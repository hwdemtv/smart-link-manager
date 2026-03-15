CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`prefix` varchar(16) NOT NULL,
	`keyHash` varchar(256) NOT NULL,
	`lastUsedAt` timestamp,
	`expiresAt` timestamp,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `links` ADD `seoTitle` varchar(255);--> statement-breakpoint
ALTER TABLE `links` ADD `seoDescription` text;--> statement-breakpoint
ALTER TABLE `links` ADD `seoImage` text;--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;