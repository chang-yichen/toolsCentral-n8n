import type { MigrationContext, ReversibleMigration } from '@/databases/types';

export class AddMarketplaceFieldsToWorkflow1800000000000 implements ReversibleMigration {
	transaction = false as const;

	async up({ runQuery, escape }: MigrationContext) {
		const table = escape.tableName('workflow_entity');

		// Add new columns for marketplace functionality
		await runQuery(`ALTER TABLE ${table} ADD COLUMN "isPublished" boolean NOT NULL DEFAULT (0)`);
		await runQuery(`ALTER TABLE ${table} ADD COLUMN "marketplaceDescription" text`);
		await runQuery(`ALTER TABLE ${table} ADD COLUMN "marketplaceCategory" varchar`);
		await runQuery(
			`ALTER TABLE ${table} ADD COLUMN "marketplaceDownloads" integer NOT NULL DEFAULT (0)`,
		);
		await runQuery(
			`ALTER TABLE ${table} ADD COLUMN "marketplaceIsPublic" boolean NOT NULL DEFAULT (0)`,
		);

		// Create index on marketplaceIsPublic
		await runQuery(
			`CREATE INDEX "IDX_workflow_marketplace_public" ON ${table} ("marketplaceIsPublic")`,
		);
	}

	async down({ runQuery, escape }: MigrationContext) {
		const table = escape.tableName('workflow_entity');

		// Drop the index first
		await runQuery(`DROP INDEX "IDX_workflow_marketplace_public"`);

		// Drop columns
		await runQuery(`ALTER TABLE ${table} DROP COLUMN "isPublished"`);
		await runQuery(`ALTER TABLE ${table} DROP COLUMN "marketplaceDescription"`);
		await runQuery(`ALTER TABLE ${table} DROP COLUMN "marketplaceCategory"`);
		await runQuery(`ALTER TABLE ${table} DROP COLUMN "marketplaceDownloads"`);
		await runQuery(`ALTER TABLE ${table} DROP COLUMN "marketplaceIsPublic"`);
	}
}
