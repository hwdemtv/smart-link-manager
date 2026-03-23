-- Enhance notifications table for admin broadcasts
-- Make userId nullable for broadcast notifications
ALTER TABLE `notifications` MODIFY `userId` int DEFAULT NULL;

-- Add senderId column for tracking who sent admin notifications
ALTER TABLE `notifications` ADD COLUMN `senderId` int DEFAULT NULL;
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_senderId_users_id_fk` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Make linkId nullable for non-link-related notifications
ALTER TABLE `notifications` MODIFY `linkId` int DEFAULT NULL;

-- Add priority column
ALTER TABLE `notifications` ADD COLUMN `priority` enum('low','normal','high') NOT NULL DEFAULT 'normal';

-- Add index for efficient queries
CREATE INDEX `notifications_userId_isRead_idx` ON `notifications` (`userId`, `isRead`);
CREATE INDEX `notifications_type_idx` ON `notifications` (`type`);
