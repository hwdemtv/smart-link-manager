SET FOREIGN_KEY_CHECKS = 0;

-- Drop existing tables to ensure a clean start
DROP TABLE IF EXISTS `api_keys`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `configs`;
DROP TABLE IF EXISTS `domains`;
DROP TABLE IF EXISTS `ip_blacklist`;
DROP TABLE IF EXISTS `link_checks`;
DROP TABLE IF EXISTS `link_groups`;
DROP TABLE IF EXISTS `links`;
DROP TABLE IF EXISTS `link_stats`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `usage_logs`;
DROP TABLE IF EXISTS `users`;

-- 1. 用户表
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `openId` varchar(64) NOT NULL,
  `username` varchar(64) DEFAULT NULL,
  `passwordHash` varchar(256) DEFAULT NULL,
  `name` text DEFAULT NULL,
  `email` varchar(320) DEFAULT NULL,
  `loginMethod` varchar(64) DEFAULT NULL,
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `isActive` int(11) NOT NULL DEFAULT 1,
  `lastIpAddress` varchar(45) DEFAULT NULL,
  `subscriptionTier` varchar(50) NOT NULL DEFAULT 'free',
  `licenseKey` varchar(255) DEFAULT NULL,
  `licenseExpiresAt` timestamp NULL DEFAULT NULL,
  `licenseToken` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_openId_unique` (`openId`),
  UNIQUE KEY `users_username_unique` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 分组表
CREATE TABLE IF NOT EXISTS `link_groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `userId` int(11) NOT NULL, 
  `name` varchar(64) NOT NULL, 
  `color` varchar(7) NOT NULL, 
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 链接主表
CREATE TABLE `links` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `originalUrl` text NOT NULL,
  `shortCode` varchar(20) NOT NULL,
  `customDomain` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `isActive` int(11) NOT NULL DEFAULT 1,
  `isValid` int(11) NOT NULL DEFAULT 1,
  `lastCheckedAt` timestamp NULL DEFAULT NULL,
  `clickCount` int(11) NOT NULL DEFAULT 0,
  `expiresAt` timestamp NULL DEFAULT NULL,
  `passwordHash` varchar(256) DEFAULT NULL,
  `tags` json DEFAULT NULL,
  `seoTitle` varchar(255) DEFAULT NULL,
  `seoDescription` text DEFAULT NULL,
  `seoImage` text DEFAULT NULL,
  `abTestEnabled` int(11) NOT NULL DEFAULT 0,
  `abTestUrl` text DEFAULT NULL,
  `abTestRatio` int(11) NOT NULL DEFAULT 50,
  `isDeleted` int(11) NOT NULL DEFAULT 0,
  `deletedAt` timestamp NULL DEFAULT NULL,
  `originalShortCode` varchar(20) DEFAULT NULL,
  `groupId` int(11) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `shortCodeDomainIdx` (`shortCode`,`customDomain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 统计表
CREATE TABLE `link_stats` (
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `linkId` int(11) NOT NULL, 
  `userAgent` text, 
  `deviceType` varchar(20), 
  `osName` varchar(50), 
  `browserName` varchar(50), 
  `ipAddress` varchar(45), 
  `country` varchar(100), 
  `city` varchar(100), 
  `referer` text, 
  `variant` varchar(10), 
  `clickedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. 配置表
CREATE TABLE `configs` (
  `key` varchar(128) NOT NULL, 
  `value` json NOT NULL, 
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, 
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. 黑名单表
CREATE TABLE `ip_blacklist` (
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `ipPattern` varchar(45) NOT NULL, 
  `reason` varchar(255), 
  `createdBy` int(11) DEFAULT NULL,
  `expiresAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. 审计与日志等剩余表
CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `userId` int(11) DEFAULT NULL, 
  `senderId` int(11) DEFAULT NULL,
  `linkId` int(11) DEFAULT NULL,
  `type` varchar(50) NOT NULL, 
  `title` varchar(255) NOT NULL, 
  `message` text, 
  `priority` enum('low','normal','high') NOT NULL DEFAULT 'normal',
  `isRead` int(11) NOT NULL DEFAULT 0, 
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `usage_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `userId` int(11) NOT NULL, 
  `date` varchar(10) NOT NULL, 
  `linksCreated` int(11) NOT NULL DEFAULT 0, 
  `apiCalls` int(11) NOT NULL DEFAULT 0,
  `totalClicks` int(11) NOT NULL DEFAULT 0, 
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `userId` int(11) DEFAULT NULL, 
  `action` varchar(100) NOT NULL, 
  `targetType` varchar(50) DEFAULT NULL, 
  `targetId` int(11) DEFAULT NULL, 
  `details` json DEFAULT NULL, 
  `ipAddress` varchar(45) DEFAULT NULL,
  `userAgent` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `api_keys` (
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `userId` int(11) NOT NULL, 
  `name` varchar(255) NOT NULL, 
  `prefix` varchar(16) NOT NULL, 
  `keyHash` varchar(256) NOT NULL, 
  `lastUsedAt` timestamp NULL DEFAULT NULL,
  `expiresAt` timestamp NULL DEFAULT NULL,
  `isActive` int(11) NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `link_checks` (
  `id` int(11) NOT NULL AUTO_INCREMENT, 
  `linkId` int(11) NOT NULL, 
  `isValid` int(11) NOT NULL, 
  `statusCode` int(11) DEFAULT NULL,
  `errorMessage` text DEFAULT NULL,
  `checkedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
