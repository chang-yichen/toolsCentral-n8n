import {
	Column,
	Entity,
	Index,
	JoinColumn,
	JoinTable,
	ManyToMany,
	ManyToOne,
	OneToMany,
} from '@n8n/typeorm';
import { Length } from 'class-validator';
import { IConnections, IDataObject, IWorkflowSettings, WorkflowFEMeta } from 'n8n-workflow';
import type { IBinaryKeyData, INode, IPairedItemData } from 'n8n-workflow';

import type { IWorkflowDb } from '@/interfaces';

import { WithTimestampsAndStringId, dbType, jsonColumnType } from './abstract-entity';
import { type Folder } from './folder';
import type { SharedWorkflow } from './shared-workflow';
import type { TagEntity } from './tag-entity';
import type { WorkflowStatistics } from './workflow-statistics';
import type { WorkflowTagMapping } from './workflow-tag-mapping';
import { objectRetriever, sqlite } from '../utils/transformers';

@Entity()
export class WorkflowEntity extends WithTimestampsAndStringId implements IWorkflowDb {
	// TODO: Add XSS check
	@Index({ unique: true })
	@Length(1, 128, {
		message: 'Workflow name must be $constraint1 to $constraint2 characters long.',
	})
	@Column({ length: 128 })
	name: string;

	@Column()
	active: boolean;

	@Column(jsonColumnType)
	nodes: INode[];

	@Column(jsonColumnType)
	connections: IConnections;

	@Column({
		type: jsonColumnType,
		nullable: true,
	})
	settings?: IWorkflowSettings;

	@Column({
		type: jsonColumnType,
		nullable: true,
		transformer: objectRetriever,
	})
	staticData?: IDataObject;

	@Column({
		type: jsonColumnType,
		nullable: true,
		transformer: objectRetriever,
	})
	meta?: WorkflowFEMeta;

	@ManyToMany('TagEntity', 'workflows')
	@JoinTable({
		name: 'workflows_tags', // table name for the junction table of this relation
		joinColumn: {
			name: 'workflowId',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'tagId',
			referencedColumnName: 'id',
		},
	})
	tags?: TagEntity[];

	@OneToMany('WorkflowTagMapping', 'workflows')
	tagMappings: WorkflowTagMapping[];

	@OneToMany('SharedWorkflow', 'workflow')
	shared: SharedWorkflow[];

	@OneToMany('WorkflowStatistics', 'workflow')
	@JoinColumn({ referencedColumnName: 'workflow' })
	statistics: WorkflowStatistics[];

	@Column({
		type: dbType === 'sqlite' ? 'text' : 'json',
		nullable: true,
		transformer: sqlite.jsonColumn,
	})
	pinData?: ISimplifiedPinData;

	@Column({ length: 36 })
	versionId: string;

	@Column({ default: 0 })
	triggerCount: number;

	@ManyToOne('Folder', 'workflows', {
		nullable: true,
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'parentFolderId' })
	parentFolder: Folder | null;

	@Column({ default: false })
	isPublished: boolean;

	@Column({ nullable: true })
	marketplaceDescription: string;

	@Column({ nullable: true })
	marketplaceCategory: string;

	@Column({ default: 0 })
	marketplaceDownloads: number;

	@Index()
	@Column({ default: false })
	marketplaceIsPublic: boolean;
}

/**
 * Simplified to prevent excessively deep type instantiation error from
 * `INodeExecutionData` in `IPinData` in a TypeORM entity field.
 */
export interface ISimplifiedPinData {
	[nodeName: string]: Array<{
		json: IDataObject;
		binary?: IBinaryKeyData;
		pairedItem?: IPairedItemData | IPairedItemData[] | number;
	}>;
}
