CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`googleEventId` varchar(255),
	`calendarId` varchar(255),
	`title` varchar(500) NOT NULL,
	`description` text,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`date` varchar(10) NOT NULL,
	`category` varchar(100),
	`recurrence` text,
	`lastSynced` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
