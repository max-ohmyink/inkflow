CREATE TABLE `stencil_jobs` (
	`id` varchar(36) NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`clientId` varchar(128) NOT NULL,
	`requestId` varchar(128),
	`concept` varchar(240) NOT NULL,
	`style` enum('fine_line','traditional','geometric','cyber') NOT NULL,
	`medium` enum('blackwork','jagua','twotone') NOT NULL,
	`prompt` text NOT NULL,
	`status` enum('queued','generating','processing','ready','failed') NOT NULL DEFAULT 'queued',
	`stage` varchar(128) NOT NULL DEFAULT 'Queued',
	`progress` int NOT NULL DEFAULT 0,
	`error` varchar(512),
	`workerId` varchar(128),
	`startedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stencil_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `stencil_jobs_client_request_unique` UNIQUE(`clientId`,`requestId`)
);
--> statement-breakpoint
CREATE TABLE `stencil_options` (
	`id` varchar(36) NOT NULL,
	`jobId` varchar(36) NOT NULL,
	`optionIndex` int NOT NULL,
	`originalStorageKey` varchar(512) NOT NULL,
	`stencilStorageKey` varchar(512) NOT NULL,
	`svgStorageKey` varchar(512),
	`width` int NOT NULL,
	`height` int NOT NULL,
	`mirrored` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stencil_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `stencil_options_job_index_unique` UNIQUE(`jobId`,`optionIndex`)
);
--> statement-breakpoint
CREATE INDEX `stencil_jobs_status_started_index` ON `stencil_jobs` (`status`,`startedAt`);--> statement-breakpoint
CREATE INDEX `stencil_options_job_index` ON `stencil_options` (`jobId`);