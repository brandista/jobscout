CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(255),
	`source` varchar(100) NOT NULL,
	`title` varchar(500) NOT NULL,
	`company` varchar(255) NOT NULL,
	`description` text,
	`location` varchar(255),
	`salaryMin` int,
	`salaryMax` int,
	`employmentType` varchar(100),
	`remoteType` varchar(50),
	`industry` varchar(255),
	`requiredSkills` text,
	`experienceRequired` int,
	`postedAt` timestamp,
	`expiresAt` timestamp,
	`url` varchar(1000),
	`companyRating` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`totalScore` int NOT NULL,
	`skillScore` int,
	`experienceScore` int,
	`locationScore` int,
	`salaryScore` int,
	`industryScore` int,
	`companyScore` int,
	`matchCategory` varchar(50),
	`matchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`currentTitle` varchar(255),
	`yearsOfExperience` int,
	`skills` text,
	`languages` text,
	`certifications` text,
	`degree` varchar(255),
	`field` varchar(255),
	`university` varchar(255),
	`graduationYear` int,
	`preferredJobTitles` text,
	`preferredIndustries` text,
	`preferredLocations` text,
	`employmentTypes` text,
	`salaryMin` int,
	`salaryMax` int,
	`remotePreference` varchar(50),
	`workHistory` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `savedJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`notes` text,
	`savedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `savedJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scoutHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`searchParams` text,
	`resultsCount` int NOT NULL,
	`newMatchesCount` int,
	`sources` text,
	`status` varchar(50) NOT NULL,
	`errorMessage` text,
	`executedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scoutHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `matches` ADD CONSTRAINT `matches_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matches` ADD CONSTRAINT `matches_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `savedJobs` ADD CONSTRAINT `savedJobs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `savedJobs` ADD CONSTRAINT `savedJobs_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scoutHistory` ADD CONSTRAINT `scoutHistory_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;