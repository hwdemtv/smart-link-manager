CREATE TABLE `domains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`domain` varchar(255) NOT NULL,
	`isVerified` int NOT NULL DEFAULT 0,
	`verificationToken` varchar(255),
	`verificationMethod` varchar(50),
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `domains_id` PRIMARY KEY(`id`),
	CONSTRAINT `domains_domain_unique` UNIQUE(`domain`)
);
--> statement-breakpoint
ALTER TABLE `links` DROP INDEX `links_shortCode_unique`;--> statement-breakpoint
ALTER TABLE `links` ADD `customDomain` varchar(255);--> statement-breakpoint
ALTER TABLE `domains` ADD CONSTRAINT `domains_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;