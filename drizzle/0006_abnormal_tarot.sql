CREATE TABLE `appointmentHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`appointmentId` int NOT NULL,
	`googleEventId` varchar(255),
	`changeType` enum('created','status_changed','rescheduled','notes_updated','reminders_updated','deleted') NOT NULL,
	`fieldChanged` varchar(100),
	`oldValue` text,
	`newValue` text,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appointmentHistory_id` PRIMARY KEY(`id`)
);
