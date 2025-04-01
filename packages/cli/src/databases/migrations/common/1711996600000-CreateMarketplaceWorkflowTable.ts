import type { MigrationContext, ReversibleMigration } from '@/databases/types';

// Implement ReversibleMigration directly for SQLite specifics
export class CreateMarketplaceWorkflowTable1711996600000 implements ReversibleMigration {
	// SQLite often doesn't support transactional DDL
	transaction = false as const;

	async up({ runQuery, escape }: MigrationContext) {
		const table = escape.tableName('marketplace_workflow');

		await runQuery(`
            CREATE TABLE ${table} (
                "id" varchar PRIMARY KEY NOT NULL,
                "createdAt" datetime NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
                "updatedAt" datetime NOT NULL DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
                "name" varchar NOT NULL,
                "description" text NOT NULL,
                "category" varchar NOT NULL,
                "authorId" varchar NOT NULL,
                "authorName" varchar NOT NULL,
                "workflowJson" text NOT NULL, -- Using text for simple-json in SQLite
                "downloads" integer NOT NULL DEFAULT (0),
                "isPublic" boolean NOT NULL DEFAULT (1),
                "originalWorkflowId" varchar,
                "createdByUserId" varchar NOT NULL
            )
        `);

		await runQuery(`CREATE INDEX "IDX_marketplace_workflow_name" ON ${table} ("name")`);
		await runQuery(
			`CREATE INDEX "IDX_marketplace_workflow_createdByUserId" ON ${table} ("createdByUserId")`,
		);
	}

	async down({ runQuery, escape }: MigrationContext) {
		const table = escape.tableName('marketplace_workflow');

		await runQuery(`DROP INDEX "IDX_marketplace_workflow_createdByUserId"`);
		await runQuery(`DROP INDEX "IDX_marketplace_workflow_name"`);
		await runQuery(`DROP TABLE ${table}`);
	}
}
