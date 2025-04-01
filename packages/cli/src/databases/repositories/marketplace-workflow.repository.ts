import { Service } from '@n8n/di'; // Import Service decorator
import { DataSource, Repository } from '@n8n/typeorm';

import { MarketplaceWorkflowEntity } from '../entities/marketplace-workflow-entity'; // Use relative path

@Service() // Add Service decorator
export class MarketplaceWorkflowRepository extends Repository<MarketplaceWorkflowEntity> {
	constructor(dataSource: DataSource) {
		super(MarketplaceWorkflowEntity, dataSource.manager);
	}

	// Add custom repository methods here if needed in the future
}
