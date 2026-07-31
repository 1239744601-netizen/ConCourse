-- CourseKeys D1 metadata foundation retained from the approved prototype.
--
-- DO NOT APPLY THIS MIGRATION TO SUPABASE.
-- DO NOT USE THIS SCHEMA TO ENABLE PUBLICATION, DOWNLOADS, OR TRANSACTIONS.
--
-- Before this migration is promoted to a live CourseKeys D1 database, add and
-- test atomic upload quotas, deletion/retention queues, immutable scan and
-- moderation audit fields, current verification enforcement, and balanced
-- ledger posting/reversal constraints. The integrated ConCourse UI and Pages
-- Function remain fail closed.

CREATE TABLE `campus_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`institution_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`assurance_method` text DEFAULT 'admin_review' NOT NULL,
	`verified_at` text,
	`expires_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `coursekeys_users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "campus_verifications_status_check" CHECK("campus_verifications"."status" in ('pending', 'verified', 'expired', 'revoked'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campus_verifications_user_institution_uidx` ON `campus_verifications` (`user_id`,`institution_id`);--> statement-breakpoint
CREATE INDEX `campus_verifications_lookup_idx` ON `campus_verifications` (`user_id`,`institution_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `coursekeys_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`campus_verification_id` text,
	`institution_id` text NOT NULL,
	`course_key` text NOT NULL,
	`course_title` text NOT NULL,
	`resource_title` text NOT NULL,
	`resource_type` text NOT NULL,
	`coursekeys_price` integer DEFAULT 0 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`language` text NOT NULL,
	`sharing_scope` text NOT NULL,
	`original_filename` text NOT NULL,
	`declared_content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_key` text NOT NULL,
	`checksum_sha256` text,
	`status` text DEFAULT 'quarantined' NOT NULL,
	`scan_status` text DEFAULT 'pending' NOT NULL,
	`moderation_status` text DEFAULT 'not_requested' NOT NULL,
	`rights_attested_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text,
	FOREIGN KEY (`owner_user_id`) REFERENCES `coursekeys_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campus_verification_id`) REFERENCES `campus_verifications`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "coursekeys_resources_scope_check" CHECK("coursekeys_resources"."sharing_scope" in ('private', 'course')),
	CONSTRAINT "coursekeys_resources_status_check" CHECK("coursekeys_resources"."status" in ('quarantined', 'scanning', 'pending_review', 'published', 'rejected', 'removed')),
	CONSTRAINT "coursekeys_resources_scan_status_check" CHECK("coursekeys_resources"."scan_status" in ('pending', 'scanning', 'clean', 'infected', 'error', 'unavailable')),
	CONSTRAINT "coursekeys_resources_moderation_status_check" CHECK("coursekeys_resources"."moderation_status" in ('not_requested', 'pending', 'approved', 'rejected')),
	CONSTRAINT "coursekeys_resources_size_check" CHECK("coursekeys_resources"."size_bytes" > 0 and "coursekeys_resources"."size_bytes" <= 26214400),
	CONSTRAINT "coursekeys_resources_price_check" CHECK("coursekeys_resources"."coursekeys_price" >= 0 and "coursekeys_resources"."coursekeys_price" <= 1000),
	CONSTRAINT "coursekeys_resources_course_verification_check" CHECK("coursekeys_resources"."sharing_scope" = 'private' or "coursekeys_resources"."campus_verification_id" is not null),
	CONSTRAINT "coursekeys_resources_publish_gate_check" CHECK("coursekeys_resources"."status" <> 'published' or ("coursekeys_resources"."sharing_scope" = 'course' and "coursekeys_resources"."scan_status" = 'clean' and "coursekeys_resources"."moderation_status" = 'approved' and "coursekeys_resources"."published_at" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coursekeys_resources_storage_key_uidx` ON `coursekeys_resources` (`storage_key`);--> statement-breakpoint
CREATE INDEX `coursekeys_resources_owner_created_idx` ON `coursekeys_resources` (`owner_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `coursekeys_resources_library_idx` ON `coursekeys_resources` (`status`,`institution_id`,`course_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `coursekeys_users` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_identity_key` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "coursekeys_users_status_check" CHECK("coursekeys_users"."status" in ('active', 'suspended', 'deleted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coursekeys_users_auth_identity_key_uidx` ON `coursekeys_users` (`auth_identity_key`);--> statement-breakpoint
CREATE TABLE `coursekeys_credit_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`account_type` text NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `coursekeys_users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "coursekeys_credit_accounts_type_check" CHECK("coursekeys_credit_accounts"."account_type" in ('user', 'issuance', 'escrow', 'sink')),
	CONSTRAINT "coursekeys_credit_accounts_owner_check" CHECK(("coursekeys_credit_accounts"."account_type" = 'user' and "coursekeys_credit_accounts"."user_id" is not null) or ("coursekeys_credit_accounts"."account_type" <> 'user' and "coursekeys_credit_accounts"."user_id" is null)),
	CONSTRAINT "coursekeys_credit_accounts_balance_check" CHECK("coursekeys_credit_accounts"."account_type" = 'issuance' or "coursekeys_credit_accounts"."balance" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coursekeys_credit_accounts_user_uidx` ON `coursekeys_credit_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `coursekeys_credit_accounts_type_idx` ON `coursekeys_credit_accounts` (`account_type`);--> statement-breakpoint
CREATE TABLE `coursekeys_credit_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`transfer_id` text NOT NULL,
	`account_id` text NOT NULL,
	`delta` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transfer_id`) REFERENCES `coursekeys_credit_transfers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`account_id`) REFERENCES `coursekeys_credit_accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "coursekeys_credit_entries_delta_check" CHECK("coursekeys_credit_entries"."delta" <> 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coursekeys_credit_entries_transfer_account_uidx` ON `coursekeys_credit_entries` (`transfer_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `coursekeys_credit_entries_account_created_idx` ON `coursekeys_credit_entries` (`account_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `coursekeys_credit_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`resource_id` text,
	`idempotency_key` text NOT NULL,
	`reversal_of_transfer_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`posted_at` text,
	FOREIGN KEY (`resource_id`) REFERENCES `coursekeys_resources`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "coursekeys_credit_transfers_kind_check" CHECK("coursekeys_credit_transfers"."kind" in ('contribution_award', 'purchase', 'refund', 'release', 'adjustment')),
	CONSTRAINT "coursekeys_credit_transfers_state_check" CHECK("coursekeys_credit_transfers"."state" in ('pending', 'posted', 'reversed')),
	CONSTRAINT "coursekeys_credit_transfers_posted_at_check" CHECK("coursekeys_credit_transfers"."state" <> 'posted' or "coursekeys_credit_transfers"."posted_at" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coursekeys_credit_transfers_idempotency_uidx` ON `coursekeys_credit_transfers` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `coursekeys_credit_transfers_resource_idx` ON `coursekeys_credit_transfers` (`resource_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `coursekeys_material_entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`buyer_user_id` text NOT NULL,
	`purchase_transfer_id` text NOT NULL,
	`coursekeys_paid` integer NOT NULL,
	`granted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`resource_id`) REFERENCES `coursekeys_resources`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`buyer_user_id`) REFERENCES `coursekeys_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`purchase_transfer_id`) REFERENCES `coursekeys_credit_transfers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "coursekeys_entitlements_price_check" CHECK("coursekeys_material_entitlements"."coursekeys_paid" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coursekeys_entitlements_buyer_resource_uidx` ON `coursekeys_material_entitlements` (`buyer_user_id`,`resource_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `coursekeys_entitlements_transfer_uidx` ON `coursekeys_material_entitlements` (`purchase_transfer_id`);--> statement-breakpoint
CREATE TABLE `coursekeys_resource_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`reporter_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`resource_id`) REFERENCES `coursekeys_resources`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reporter_user_id`) REFERENCES `coursekeys_users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "coursekeys_resource_reports_reason_check" CHECK("coursekeys_resource_reports"."reason" in ('copyright', 'academic_integrity', 'privacy', 'malware', 'spam', 'other')),
	CONSTRAINT "coursekeys_resource_reports_status_check" CHECK("coursekeys_resource_reports"."status" in ('open', 'reviewing', 'resolved', 'dismissed'))
);
--> statement-breakpoint
CREATE INDEX `coursekeys_resource_reports_review_idx` ON `coursekeys_resource_reports` (`status`,`created_at`);
