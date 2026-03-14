CREATE TABLE `link_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`isValid` int NOT NULL,
	`statusCode` int,
	`errorMessage` text,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `link_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `link_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`userAgent` text,
	`deviceType` varchar(20),
	`osName` varchar(50),
	`browserName` varchar(50),
	`ipAddress` varchar(45),
	`country` varchar(100),
	`city` varchar(100),
	`referer` text,
	`clickedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `link_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`originalUrl` text NOT NULL,
	`shortCode` varchar(20) NOT NULL,
	`description` text,
	`isActive` int NOT NULL DEFAULT 1,
	`isValid` int NOT NULL DEFAULT 1,
	`lastCheckedAt` timestamp,
	`clickCount` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `links_id` PRIMARY KEY(`id`),
	CONSTRAINT `links_shortCode_unique` UNIQUE(`shortCode`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`linkId` int NOT NULL,
	`type` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `link_checks` ADD CONSTRAINT `link_checks_linkId_links_id_fk` FOREIGN KEY (`linkId`) REFERENCES `links`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `link_stats` ADD CONSTRAINT `link_stats_linkId_links_id_fk` FOREIGN KEY (`linkId`) REFERENCES `links`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `links` ADD CONSTRAINT `links_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_linkId_links_id_fk` FOREIGN KEY (`linkId`) REFERENCES `links`(`id`) ON DELETE cascade ON UPDATE no action;