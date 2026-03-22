-- Create subscription_change_requests table
CREATE TABLE IF NOT EXISTS `subscription_change_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`requestedPlanId` int NOT NULL,
	`currentPlanId` int,
	`billingCycle` enum('monthly','yearly') NOT NULL,
	`reason` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`reviewNote` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_change_requests_id` PRIMARY KEY(`id`)
);

-- Add foreign keys
ALTER TABLE `subscription_change_requests` ADD CONSTRAINT `subscription_change_requests_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `subscription_change_requests` ADD CONSTRAINT `subscription_change_requests_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `subscription_change_requests` ADD CONSTRAINT `subscription_change_requests_requestedPlanId_subscription_plans_id_fk` FOREIGN KEY (`requestedPlanId`) REFERENCES `subscription_plans`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `subscription_change_requests` ADD CONSTRAINT `subscription_change_requests_currentPlanId_subscription_plans_id_fk` FOREIGN KEY (`currentPlanId`) REFERENCES `subscription_plans`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `subscription_change_requests` ADD CONSTRAINT `subscription_change_requests_reviewedBy_users_id_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
