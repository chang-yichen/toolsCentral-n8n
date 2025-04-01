import {
	Column,
	Entity,
	Index,
	PrimaryColumn,
	BeforeInsert,
	CreateDateColumn,
	UpdateDateColumn,
	BeforeUpdate,
} from '@n8n/typeorm';
import { generateNanoId } from '../utils/generators';
import type { INode, IConnections, IWorkflowSettings, IDataObject } from 'n8n-workflow';
import { datetimeColumnType } from './abstract-entity'; // Keep datetimeColumnType import

// Define an interface for the stored JSON data
interface StoredWorkflowData {
	nodes: INode[];
	connections: IConnections;
	settings?: IWorkflowSettings;
	staticData?: IDataObject;
}

@Entity('marketplace_workflow')
export class MarketplaceWorkflowEntity {
	@PrimaryColumn('varchar', { generated: false })
	id: string;

	@CreateDateColumn({
		precision: 3,
		type: datetimeColumnType,
	})
	createdAt: Date;

	@UpdateDateColumn({
		precision: 3,
		type: datetimeColumnType,
	})
	updatedAt: Date;

	@BeforeInsert()
	generateId() {
		if (!this.id) {
			this.id = generateNanoId();
		}
	}

	@Index()
	@Column()
	name: string;

	@Column('text')
	description: string;

	@Column()
	category: string; // e.g., 'automation', 'data-processing'

	@Column()
	authorId: string; // Reference to the user who published it

	@Column()
	authorName: string; // Denormalized for easier display

	@Column('simple-json')
	workflowJson: StoredWorkflowData; // Use the specific interface type

	@Column({ default: 0 })
	downloads: number;

	@Column({ default: true })
	isPublic: boolean;

	@Column({ nullable: true }) // ID of the original workflow this was published from
	originalWorkflowId?: string;

	@Index()
	@Column() // To allow filtering by creator
	createdByUserId: string;
}
