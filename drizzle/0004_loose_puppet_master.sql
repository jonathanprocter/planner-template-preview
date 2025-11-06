CREATE TABLE `deletedAppointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`googleEventId` varchar(255) NOT NULL,
	`calendarId` varchar(255),
	`deletedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deletedAppointments_id` PRIMARY KEY(`id`)
);
