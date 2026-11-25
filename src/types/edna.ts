export interface DbUser {
  id: string;
  uid: string;
  fullName: string;
  username: string;
  email: string;
  institution: string;
  department: string;
  researchField: string;
  country: string;
  userCategory: string;
  role: 'user' | 'admin';
  accountStatus: 'active' | 'suspended' | 'deactivated';
  avatarUrl: string | null;
  emailVerified: boolean;
  preferences: {
    emailNotifications: boolean;
    defaultMarker: string;
    defaultDatabase: string;
  };
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchProject {
  id: string;
  userId: string;
  projectName: string;
  description: string;
  researchObjective: string;
  region: string;
  status: string;
  createdAt: string;
}

export interface EnvironmentalConditions {
  temperatureC?: number;
  pH?: number;
  salinityPpt?: number;
  dissolvedOxygenMgL?: number;
  depthM?: number;
  notes?: string;
}

export interface Dataset {
  id: string;
  projectId: string;
  userId: string;
  fileName: string;
  storagePath: string;
  fileFormat: string;
  fileSize: number;
  recordCount: number;
  description: string;
  sampleType: string;
  samplingLocation: string;
  country: string;
  region: string;
  collectionDate: string;
  latitude: number | null;
  longitude: number | null;
  environmentalConditions: EnvironmentalConditions;
  processingStatus: string;
  createdAt: string;
}

export interface TaxonomicResult {
  id?: string;
  datasetId: string;
  sampleId: string | null;
  sequenceId: string;
  markerGene: string;
  referenceDatabase: string;
  kingdom: string;
  phylum: string;
  taxonomicClass: string;
  taxonomicOrder: string;
  family: string;
  genus: string;
  species: string;
  percentIdentity: number;
  queryCoverage: number;
  eValue: string;
  referenceAccession: string;
  confidenceScore: number;
  abundanceCount: number;
  identificationStatus: string;
  matchSource: string;
}

export interface AlphaDiversityMetrics {
  sampleId: string | null;
  sampleLabel: string;
  richness: number;
  totalIndividuals: number;
  shannonIndex: number;
  simpsonIndex: number;
  pielouEvenness: number;
  chao1Estimate: number | null;
  calculationNotes: string;
}

export interface BiodiversityAssessment {
  valid: boolean;
  validationError?: string;
  datasetAlpha: AlphaDiversityMetrics;
  sampleAlphas: AlphaDiversityMetrics[];
  betaMatrix: Array<{
    rowSample: string;
    colSample: string;
    brayCurtisDissimilarity: number;
    jaccardDissimilarity: number;
    jaccardSimilarity: number;
  }>;
  sampleNames: string[];
  pcoa: {
    points: Array<{
      sampleLabel: string;
      pc1: number;
      pc2: number;
      richness: number;
      shannonIndex: number;
    }>;
    varianceExplainedPct: [number, number];
    note: string;
  };
  compositionByRank: Record<
    'kingdom' | 'phylum' | 'class' | 'order' | 'family' | 'genus' | 'species',
    Array<{
      name: string;
      abundance: number;
      relativeAbundancePct: number;
      taxaCount: number;
    }>
  >;
  rareAndDominant: {
    dominant: Array<{ species: string; abundance: number; relativePct: number }>;
    rare: Array<{ species: string; abundance: number; relativePct: number }>;
  };
  methodology: {
    inputRecordsUsed: number;
    excludedUnassignedRecords: number;
    formulas: Array<{ metric: string; formula: string; assumption: string }>;
  };
}

export interface GeographicSite {
  id: string;
  datasetId: string;
  datasetName: string;
  sampleCode: string;
  samplingLocation: string;
  collectionDate: string;
  sampleType: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  richness: number;
  shannonIndex: number;
  simpsonIndex: number;
  topTaxa: string[];
  environmentalConditions: EnvironmentalConditions;
}

export interface GeneratedReport {
  id: string;
  userId: string;
  datasetId: string;
  reportName: string;
  reportFormat: 'PDF' | 'XLSX' | 'CSV';
  storagePath: string;
  engineVersion: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string | null;
  title: string;
  message: string;
  category: string;
  status: 'unread' | 'read';
  createdAt: string;
}

export interface ReferenceDatabase {
  id: string;
  name: string;
  markerRegions: string[];
  version: string;
  connectionMode: string;
  isActive: boolean;
  description: string;
  updatedAt: string;
}

export type AppSection =
  | 'dashboard'
  | 'projects'
  | 'upload'
  | 'datasets'
  | 'taxonomy'
  | 'biodiversity'
  | 'geography'
  | 'assistant'
  | 'reports'
  | 'notifications'
  | 'profile'
  | 'settings';
