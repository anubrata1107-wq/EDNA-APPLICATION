import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export interface UserPreferences {
  emailNotifications: boolean;
  defaultMarker: string;
  defaultDatabase: string;
}

export interface EnvironmentalConditions {
  temperatureC?: number;
  pH?: number;
  salinityPpt?: number;
  dissolvedOxygenMgL?: number;
  depthM?: number;
  notes?: string;
}

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    uid: text('uid').notNull().unique(),
    fullName: text('full_name').notNull(),
    username: text('username').notNull().unique(),
    email: text('email').notNull().unique(),
    institution: text('institution').notNull().default(''),
    department: text('department').notNull().default(''),
    researchField: text('research_field').notNull().default(''),
    country: text('country').notNull().default(''),
    userCategory: text('user_category').notNull().default('Scientist'),
    role: text('role').notNull().default('user'),
    accountStatus: text('account_status').notNull().default('active'),
    avatarUrl: text('avatar_url'),
    emailVerified: boolean('email_verified').notNull().default(false),
    preferences: jsonb('preferences')
      .$type<UserPreferences>()
      .default({
        emailNotifications: true,
        defaultMarker: '16S rRNA',
        defaultDatabase: 'SILVA',
      })
      .notNull(),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_users_uid').on(table.uid),
    index('idx_users_email').on(table.email),
    index('idx_users_role').on(table.role),
  ]
);

export const userActivity = pgTable(
  'user_activity',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    action: text('action').notNull(),
    details: text('details'),
    ipAddress: text('ip_address'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => [index('idx_user_activity_user_id').on(table.userId)]
);

export const applicationSettings = pgTable('application_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  settingName: text('setting_name').notNull().unique(),
  settingValue: text('setting_value').notNull(),
  description: text('description').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    category: text('category').notNull().default('info'),
    status: text('status').notNull().default('unread'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_notifications_user_id').on(table.userId)]
);

export const researchProjects = pgTable(
  'research_projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    projectName: text('project_name').notNull(),
    description: text('description').notNull().default(''),
    researchObjective: text('research_objective').notNull().default(''),
    region: text('region').notNull().default(''),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_research_projects_user_id').on(table.userId)]
);

export const datasets = pgTable(
  'datasets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => researchProjects.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    fileName: text('file_name').notNull(),
    storagePath: text('storage_path').notNull(),
    fileFormat: text('file_format').notNull(),
    fileSize: integer('file_size').notNull(),
    recordCount: integer('record_count').notNull().default(0),
    description: text('description').notNull().default(''),
    sampleType: text('sample_type').notNull(),
    samplingLocation: text('sampling_location').notNull().default(''),
    country: text('country').notNull().default(''),
    region: text('region').notNull().default(''),
    collectionDate: text('collection_date').notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    environmentalConditions: jsonb('environmental_conditions')
      .$type<EnvironmentalConditions>()
      .default({})
      .notNull(),
    processingStatus: text('processing_status').notNull().default('uploaded'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_datasets_user_id').on(table.userId),
    index('idx_datasets_project_id').on(table.projectId),
  ]
);

export const samples = pgTable(
  'samples',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    datasetId: uuid('dataset_id')
      .references(() => datasets.id, { onDelete: 'cascade' })
      .notNull(),
    sampleCode: text('sample_code').notNull(),
    samplingLocation: text('sampling_location').notNull(),
    collectionDate: text('collection_date').notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    sampleMetadata: jsonb('sample_metadata').$type<Record<string, unknown>>().default({}).notNull(),
  },
  (table) => [index('idx_samples_dataset_id').on(table.datasetId)]
);

export const sequences = pgTable(
  'sequences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    datasetId: uuid('dataset_id')
      .references(() => datasets.id, { onDelete: 'cascade' })
      .notNull(),
    sampleId: uuid('sample_id').references(() => samples.id, { onDelete: 'cascade' }),
    sequenceId: text('sequence_id').notNull(),
    sequenceData: text('sequence_data').notNull(),
    sequenceLength: integer('sequence_length').notNull().default(0),
    gcContent: doublePrecision('gc_content').notNull().default(0),
    readCount: integer('read_count').notNull().default(1),
    qualityStatus: text('quality_status').notNull().default('passed'),
  },
  (table) => [index('idx_sequences_dataset_id').on(table.datasetId)]
);

export const taxonomicResults = pgTable(
  'taxonomic_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    datasetId: uuid('dataset_id')
      .references(() => datasets.id, { onDelete: 'cascade' })
      .notNull(),
    sampleId: uuid('sample_id').references(() => samples.id, { onDelete: 'set null' }),
    sequenceId: text('sequence_id').notNull(),
    markerGene: text('marker_gene').notNull().default('16S rRNA'),
    referenceDatabase: text('reference_database').notNull().default('SILVA'),
    kingdom: text('kingdom').notNull().default('Unassigned'),
    phylum: text('phylum').notNull().default('Unassigned'),
    taxonomicClass: text('class').notNull().default('Unassigned'),
    taxonomicOrder: text('taxonomic_order').notNull().default('Unassigned'),
    family: text('family').notNull().default('Unassigned'),
    genus: text('genus').notNull().default('Unassigned'),
    species: text('species').notNull().default('Unassigned'),
    percentIdentity: doublePrecision('percent_identity').notNull().default(0),
    queryCoverage: doublePrecision('query_coverage').notNull().default(0),
    eValue: text('e_value').notNull().default('N/A'),
    referenceAccession: text('reference_accession').notNull().default('N/A'),
    confidenceScore: doublePrecision('confidence_score').notNull().default(0),
    abundanceCount: integer('abundance_count').notNull().default(1),
    identificationStatus: text('identification_status').notNull().default('unassigned'),
    matchSource: text('match_source').notNull().default('local_voucher_kmer'),
  },
  (table) => [
    index('idx_taxonomic_results_dataset_id').on(table.datasetId),
    index('idx_taxonomic_results_sample_id').on(table.sampleId),
  ]
);

export const biodiversityResults = pgTable(
  'biodiversity_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    datasetId: uuid('dataset_id')
      .references(() => datasets.id, { onDelete: 'cascade' })
      .notNull(),
    sampleId: uuid('sample_id').references(() => samples.id, { onDelete: 'cascade' }),
    sampleLabel: text('sample_label').notNull().default('Dataset Aggregate'),
    richness: integer('richness').notNull().default(0),
    totalIndividuals: integer('total_individuals').notNull().default(0),
    shannonIndex: doublePrecision('shannon_index').notNull().default(0),
    simpsonIndex: doublePrecision('simpson_index').notNull().default(0),
    pielouEvenness: doublePrecision('pielou_evenness').notNull().default(0),
    chao1Estimate: doublePrecision('chao1_estimate'),
    calculationNotes: text('calculation_notes').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_biodiversity_results_dataset_id').on(table.datasetId)]
);

export const analysisJobs = pgTable(
  'analysis_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    datasetId: uuid('dataset_id')
      .references(() => datasets.id, { onDelete: 'cascade' })
      .notNull(),
    analysisType: text('analysis_type').notNull(),
    parameters: jsonb('parameters').$type<Record<string, unknown>>().default({}).notNull(),
    status: text('status').notNull().default('queued'),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    errorMessage: text('error_message'),
  },
  (table) => [
    index('idx_analysis_jobs_user_id').on(table.userId),
    index('idx_analysis_jobs_dataset_id').on(table.datasetId),
  ]
);

export const generatedReports = pgTable(
  'generated_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    datasetId: uuid('dataset_id')
      .references(() => datasets.id, { onDelete: 'cascade' })
      .notNull(),
    reportName: text('report_name').notNull(),
    reportFormat: text('report_format').notNull(),
    storagePath: text('storage_path').notNull(),
    engineVersion: text('engine_version').notNull().default('eDNA-BioStats 1.0.0'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_generated_reports_user_id').on(table.userId)]
);

export const referenceDatabases = pgTable('reference_databases', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  markerRegions: jsonb('marker_regions').$type<string[]>().notNull(),
  version: text('version').notNull(),
  connectionMode: text('connection_mode').notNull().default('built_in_curated_vouchers'),
  isActive: boolean('is_active').notNull().default(true),
  description: text('description').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adminUserId: uuid('admin_user_id').references(() => users.id, { onDelete: 'set null' }),
    adminEmail: text('admin_email').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    details: text('details'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_admin_audit_logs_created_at').on(table.createdAt)]
);

export const adminSecurityConfig = pgTable('admin_security_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  passcodeHash: text('passcode_hash').notNull(),
  salt: text('salt').notNull(),
  claimedByUid: text('claimed_by_uid'),
  claimedAt: timestamp('claimed_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(researchProjects),
  datasets: many(datasets),
  activities: many(userActivity),
  notifications: many(notifications),
  jobs: many(analysisJobs),
  reports: many(generatedReports),
}));

export const researchProjectsRelations = relations(researchProjects, ({ one, many }) => ({
  owner: one(users, { fields: [researchProjects.userId], references: [users.id] }),
  datasets: many(datasets),
}));

export const datasetsRelations = relations(datasets, ({ one, many }) => ({
  project: one(researchProjects, { fields: [datasets.projectId], references: [researchProjects.id] }),
  owner: one(users, { fields: [datasets.userId], references: [users.id] }),
  samples: many(samples),
  sequences: many(sequences),
  taxonomicResults: many(taxonomicResults),
  biodiversityResults: many(biodiversityResults),
  jobs: many(analysisJobs),
  reports: many(generatedReports),
}));
