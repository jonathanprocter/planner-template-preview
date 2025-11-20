ALTER TABLE `appointments` ADD `status` enum('scheduled','completed','client_canceled','therapist_canceled','no_show') DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `reminders` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `sessionNumber` int;--> statement-breakpoint
ALTER TABLE `appointments` ADD `totalSessions` int;--> statement-breakpoint
ALTER TABLE `appointments` ADD `presentingConcerns` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `lastSessionDate` varchar(10);