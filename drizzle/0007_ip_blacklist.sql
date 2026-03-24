-- Create ip_blacklist table for IP blocking feature
CREATE TABLE IF NOT EXISTS `ip_blacklist` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `ipPattern` varchar(45) NOT NULL,
  `reason` varchar(255),
  `createdBy` int,
  `expiresAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `ip_blacklist_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Add index for efficient IP lookups
CREATE INDEX `ipPatternIdx` ON `ip_blacklist` (`ipPattern`);
