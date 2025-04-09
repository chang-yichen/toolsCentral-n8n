import { DataSource } from '@n8n/typeorm';
import { AddMarketplaceFieldsToWorkflow1800000000000 } from './1800000000000-AddMarketplaceFieldsToWorkflow';

// Create a basic TypeORM connection for SQLite
const dataSource = new DataSource({
	type: 'sqlite',
	database: '/Users/yichenchang/.n8n/database.sqlite',
	synchronize: false,
	migrations: [AddMarketplaceFieldsToWorkflow1800000000000],
});

// Function to run the migration
async function runMigration() {
	try {
		console.log('Connecting to the database...');
		await dataSource.initialize();

		console.log('Running marketplace fields migration...');
		await dataSource.runMigrations();

		console.log('Migration completed successfully!');
	} catch (error) {
		console.error('Error during migration:', error);
	} finally {
		if (dataSource.isInitialized) {
			await dataSource.destroy();
		}
	}
}

// Run the migration
runMigration();
