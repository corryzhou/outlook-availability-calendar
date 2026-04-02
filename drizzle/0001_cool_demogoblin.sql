CREATE TABLE `outlook_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text NOT NULL,
	`expiresAt` bigint NOT NULL,
	`scope` text,
	`tokenType` varchar(32) DEFAULT 'Bearer',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outlook_tokens_id` PRIMARY KEY(`id`)
);
