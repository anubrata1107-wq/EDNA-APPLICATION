import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  adminAuditLogs,
  adminSecurityConfig,
  analysisJobs,
  applicationSettings,
  biodiversityResults,
  datasets,
  generatedReports,
  notifications,
  referenceDatabases,
  researchProjects,
  samples,
  sequences,
  taxonomicResults,
  userActivity,
  users,
} from './src/db/schema.ts';
import {
  countAdmins,
  getOrCreateUser,
  getUserByUid,
  logUserActivity,
} from './src/db/users.ts';
import {
  type AuthRequest,
  hashPasscode,
  requireAdmin,
  requireAuth,
  requireFirebaseToken,
  signAdminToken,
  verifyPasscodeHash,
} from './src/middleware/auth.ts';
import {
  buildSampleCsvDataset,
  buildSampleFastaDataset,
  identifySequences,
  parseUploadedDatasetBuffer,
} from './src/server/bioinformatics.ts';
import {
  calculateBiodiversityAssessment,
  type TaxonAbundanceInput,
} from './src/server/biodiversity.ts';
import {
  askResearchAssistant,
  type AssistantDatasetContext,
  generateReportInterpretation,
} from './src/server/gemini.ts';
import { ensureDefaultPlatformData } from './src/server/seed.ts';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '15mb' }));

// Confined local scientific file storage directory
const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
const UPLOAD_DIR = path.resolve(STORAGE_ROOT, 'uploads');
const REPORT_DIR = path.resolve(STORAGE_ROOT, 'reports');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });

function safeResolveWithin(baseDir: string, relativePath: string): string {
  const cleaned = relativePath.replace(/^[/\\]+/, '');
  const resolved = path.resolve(baseDir, cleaned);
  if (!resolved.startsWith(baseDir + path.sep)) {
    throw new Error('Invalid file storage path');
  }
  return resolved;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Simple in-memory rate limiter for admin verification attempts
const adminRateLimit = new Map<string, { count: number; resetAt: number }>();
function checkAdminRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = adminRateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    adminRateLimit.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 12) return false;
  entry.count += 1;
  return true;
}

function detectFileFormat(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.fasta' || ext === '.fa') return 'FASTA';
  if (ext === '.fastq' || ext === '.fq') return 'FASTQ';
  if (ext === '.csv') return 'CSV';
  if (ext === '.tsv') return 'TSV';
  if (ext === '.xlsx') return 'XLSX';
  if (ext === '.json') return 'JSON';
  return null;
}

async function getDatasetContextForUser(datasetId: string, userId: string, isAdmin = false) {
  const dsRows = await db.select().from(datasets).where(eq(datasets.id, datasetId)).limit(1);
  const ds = dsRows[0];
  if (!ds) return null;
  if (!isAdmin && ds.userId !== userId) return null;

  const [taxRows, bioRows] = await Promise.all([
    db.select().from(taxonomicResults).where(eq(taxonomicResults.datasetId, datasetId)),
    db.select().from(biodiversityResults).where(eq(biodiversityResults.datasetId, datasetId)),
  ]);

  const aggregate = bioRows.find((b) => b.sampleId === null) || bioRows[0] || null;
  const context: AssistantDatasetContext = {
    datasetName: ds.fileName,
    fileFormat: ds.fileFormat,
    sampleType: ds.sampleType,
    samplingLocation: ds.samplingLocation,
    collectionDate: ds.collectionDate,
    recordCount: ds.recordCount,
    taxonomicSummary: taxRows.slice(0, 60).map((t) => ({
      species: t.species,
      genus: t.genus,
      family: t.family,
      phylum: t.phylum,
      kingdom: t.kingdom,
      abundanceCount: t.abundanceCount,
      percentIdentity: t.percentIdentity,
      identificationStatus: t.identificationStatus,
      matchSource: t.matchSource,
    })),
    biodiversitySummary: aggregate
      ? {
          richness: aggregate.richness,
          totalIndividuals: aggregate.totalIndividuals,
          shannonIndex: aggregate.shannonIndex,
          simpsonIndex: aggregate.simpsonIndex,
          pielouEvenness: aggregate.pielouEvenness,
          chao1Estimate: aggregate.chao1Estimate,
        }
      : null,
    sampleBreakdown: bioRows
      .filter((b) => b.sampleId !== null)
      .map((b) => ({
        sampleLabel: b.sampleLabel,
        richness: b.richness,
        shannonIndex: b.shannonIndex,
        simpsonIndex: b.simpsonIndex,
      })),
  };

  return { ds, taxRows, bioRows, context };
}

// ---------- PUBLIC ENDPOINTS ----------
app.get('/api/health', async (_req, res) => {
  await ensureDefaultPlatformData();
  res.json({
    status: 'ok',
    engineVersion: 'eDNA-BioStats 1.0.0',
    geminiConfigured: Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    ),
  });
});

app.get('/api/public/stats', async (_req, res) => {
  try {
    await ensureDefaultPlatformData();
    const [refDbs, settingsRows] = await Promise.all([
      db.select().from(referenceDatabases),
      db.select().from(applicationSettings),
    ]);
    const announcement =
      settingsRows.find((s) => s.settingName === 'platform_announcement')?.settingValue || '';
    res.json({
      referenceDatabases: refDbs.filter((d) => d.isActive),
      announcement,
    });
  } catch (error) {
    console.error('Public stats error:', error);
    res.status(500).json({ error: 'Unable to fetch platform metadata.' });
  }
});

app.get('/api/sample-files/:filename', (req, res) => {
  const { filename } = req.params;
  if (filename === 'freshwater_river_12s_sample.fasta') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="freshwater_river_12s_sample.fasta"');
    return res.send(buildSampleFastaDataset());
  }
  if (filename === 'estuary_metabarcoding_abundances.csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="estuary_metabarcoding_abundances.csv"'
    );
    return res.send(buildSampleCsvDataset());
  }
  return res.status(404).json({ error: 'Sample file not found.' });
});

// ---------- AUTH & PROFILE ENDPOINTS ----------
app.post('/api/auth/sync', requireFirebaseToken, async (req: AuthRequest, res) => {
  try {
    await ensureDefaultPlatformData();
    const decoded = req.firebaseUser!;
    const body = req.body as {
      fullName?: string;
      username?: string;
      institution?: string;
      department?: string;
      researchField?: string;
      country?: string;
      userCategory?: string;
      mode?: 'login' | 'register';
    };

    const existing = await getUserByUid(decoded.uid);
    if (!existing && body.mode === 'login' && !decoded.firebase?.sign_in_provider?.includes('google')) {
      return res.status(404).json({
        error: 'No researcher profile found for this account. Please register first.',
      });
    }

    const { user, isNew } = await getOrCreateUser({
      uid: decoded.uid,
      email: decoded.email || `${decoded.uid}@research.local`,
      emailVerified: Boolean(decoded.email_verified),
      fullName: body.fullName || decoded.name,
      username: body.username,
      institution: body.institution,
      department: body.department,
      researchField: body.researchField,
      country: body.country,
      userCategory: body.userCategory,
      avatarUrl: decoded.picture || null,
    });

    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        error: `Account is currently ${user.accountStatus}. Please contact an administrator.`,
      });
    }

    if (!isNew) {
      await logUserActivity(user.id, 'user_login', 'Signed in to researcher workspace', req.ip);
    }

    res.json({ user, isNew });
  } catch (error: any) {
    console.error('Auth sync error:', error);
    res.status(400).json({ error: error.message || 'Failed to synchronize account profile.' });
  }
});

app.get('/api/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const activities = await db
      .select()
      .from(userActivity)
      .where(eq(userActivity.userId, user.id))
      .orderBy(desc(userActivity.timestamp))
      .limit(20);
    res.json({ user, activities });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

app.patch('/api/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const body = req.body as {
      fullName?: string;
      institution?: string;
      department?: string;
      researchField?: string;
      country?: string;
      userCategory?: string;
      avatarUrl?: string | null;
      preferences?: {
        emailNotifications?: boolean;
        defaultMarker?: string;
        defaultDatabase?: string;
      };
    };

    const updated = await db
      .update(users)
      .set({
        ...(body.fullName ? { fullName: body.fullName.trim().slice(0, 120) } : {}),
        ...(body.institution !== undefined
          ? { institution: body.institution.trim().slice(0, 180) }
          : {}),
        ...(body.department !== undefined
          ? { department: body.department.trim().slice(0, 160) }
          : {}),
        ...(body.researchField !== undefined
          ? { researchField: body.researchField.trim().slice(0, 160) }
          : {}),
        ...(body.country !== undefined ? { country: body.country.trim().slice(0, 100) } : {}),
        ...(body.userCategory ? { userCategory: body.userCategory } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
        ...(body.preferences
          ? {
              preferences: {
                emailNotifications:
                  body.preferences.emailNotifications ?? user.preferences.emailNotifications,
                defaultMarker: body.preferences.defaultMarker ?? user.preferences.defaultMarker,
                defaultDatabase:
                  body.preferences.defaultDatabase ?? user.preferences.defaultDatabase,
              },
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    await logUserActivity(user.id, 'profile_updated', 'Updated researcher profile and preferences');
    res.json({ user: updated[0] });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

app.post('/api/profile/delete-request', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    await db
      .update(users)
      .set({ accountStatus: 'deactivated', updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await logUserActivity(user.id, 'account_deactivation_requested', 'Researcher requested deactivation');
    res.json({ message: 'Account deactivated upon researcher request.' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ error: 'Failed to process account deletion request.' });
  }
});

// ---------- NOTIFICATIONS ----------
app.get('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const rows = await db
      .select()
      .from(notifications)
      .where(or(eq(notifications.userId, user.id), sql`${notifications.userId} IS NULL`))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    res.json({ notifications: rows });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { id } = req.params;
    await db
      .update(notifications)
      .set({ status: 'read' })
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
    res.json({ ok: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    await db
      .update(notifications)
      .set({ status: 'read' })
      .where(eq(notifications.userId, user.id));
    res.json({ ok: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

// ---------- DASHBOARD SUMMARY ----------
app.get('/api/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const [userProjects, userDatasets, userJobs, userReports, recentActivity, refDbs, settings] =
      await Promise.all([
        db.select().from(researchProjects).where(eq(researchProjects.userId, user.id)),
        db
          .select()
          .from(datasets)
          .where(eq(datasets.userId, user.id))
          .orderBy(desc(datasets.createdAt)),
        db
          .select()
          .from(analysisJobs)
          .where(eq(analysisJobs.userId, user.id))
          .orderBy(desc(analysisJobs.startedAt))
          .limit(10),
        db
          .select()
          .from(generatedReports)
          .where(eq(generatedReports.userId, user.id))
          .orderBy(desc(generatedReports.createdAt))
          .limit(5),
        db
          .select()
          .from(userActivity)
          .where(eq(userActivity.userId, user.id))
          .orderBy(desc(userActivity.timestamp))
          .limit(10),
        db.select().from(referenceDatabases),
        db.select().from(applicationSettings),
      ]);

    const datasetIds = userDatasets.map((d) => d.id);
    let totalSamples = 0;
    let distinctTaxaCount = 0;
    let avgShannon = 0;
    let avgSimpson = 0;
    let avgRichness = 0;
    let taxonomicDistribution: Array<{ name: string; value: number }> = [];
    let sampleDistribution: Array<{ name: string; count: number }> = [];

    if (datasetIds.length > 0) {
      const [allSamples, allTaxa, allBio] = await Promise.all([
        db
          .select()
          .from(samples)
          .where(sql`${samples.datasetId} = ANY(${datasetIds})`),
        db
          .select()
          .from(taxonomicResults)
          .where(sql`${taxonomicResults.datasetId} = ANY(${datasetIds})`),
        db
          .select()
          .from(biodiversityResults)
          .where(sql`${biodiversityResults.datasetId} = ANY(${datasetIds})`),
      ]);

      totalSamples = allSamples.length;
      const validTaxa = allTaxa.filter((t) => t.species !== 'Unassigned');
      distinctTaxaCount = new Set(validTaxa.map((t) => t.species)).size;

      const phylumCounts = new Map<string, number>();
      for (const t of validTaxa) {
        phylumCounts.set(t.phylum, (phylumCounts.get(t.phylum) || 0) + t.abundanceCount);
      }
      taxonomicDistribution = Array.from(phylumCounts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      const sampleTypeMap = new Map<string, number>();
      for (const ds of userDatasets) {
        sampleTypeMap.set(ds.sampleType, (sampleTypeMap.get(ds.sampleType) || 0) + 1);
      }
      sampleDistribution = Array.from(sampleTypeMap.entries()).map(([name, count]) => ({
        name,
        count,
      }));

      const aggBio = allBio.filter((b) => b.sampleId === null);
      const bioPool = aggBio.length > 0 ? aggBio : allBio;
      if (bioPool.length > 0) {
        avgRichness = Number(
          (bioPool.reduce((s, b) => s + b.richness, 0) / bioPool.length).toFixed(1)
        );
        avgShannon = Number(
          (bioPool.reduce((s, b) => s + b.shannonIndex, 0) / bioPool.length).toFixed(3)
        );
        avgSimpson = Number(
          (bioPool.reduce((s, b) => s + b.simpsonIndex, 0) / bioPool.length).toFixed(3)
        );
      }
    }

    const announcement =
      settings.find((s) => s.settingName === 'platform_announcement')?.settingValue || '';

    res.json({
      stats: {
        totalProjects: userProjects.length,
        totalDatasets: userDatasets.length,
        totalAnalyzedSamples: totalSamples,
        identifiedTaxa: distinctTaxaCount,
        avgSpeciesRichness: avgRichness,
        avgShannonIndex: avgShannon,
        avgSimpsonIndex: avgSimpson,
      },
      datasets: userDatasets.slice(0, 6),
      projects: userProjects,
      recentJobs: userJobs,
      recentReports: userReports,
      recentActivity,
      taxonomicDistribution,
      sampleDistribution,
      referenceDatabases: refDbs,
      announcement,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard overview.' });
  }
});

// ---------- RESEARCH PROJECTS ----------
app.get('/api/projects', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const rows = await db
      .select()
      .from(researchProjects)
      .where(eq(researchProjects.userId, user.id))
      .orderBy(desc(researchProjects.createdAt));
    res.json({ projects: rows });
  } catch (error) {
    console.error('Projects list error:', error);
    res.status(500).json({ error: 'Failed to load research projects.' });
  }
});

app.post('/api/projects', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { projectName, description, researchObjective, region } = req.body as {
      projectName?: string;
      description?: string;
      researchObjective?: string;
      region?: string;
    };
    if (!projectName || projectName.trim().length < 2) {
      return res.status(400).json({ error: 'Project name must be at least 2 characters.' });
    }
    const created = await db
      .insert(researchProjects)
      .values({
        userId: user.id,
        projectName: projectName.trim().slice(0, 160),
        description: (description || '').trim().slice(0, 1000),
        researchObjective: (researchObjective || '').trim().slice(0, 500),
        region: (region || '').trim().slice(0, 140),
      })
      .returning();

    await logUserActivity(user.id, 'project_created', `Created project "${created[0].projectName}"`);
    res.status(201).json({ project: created[0] });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create research project.' });
  }
});

app.delete('/api/projects/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { id } = req.params;
    const deleted = await db
      .delete(researchProjects)
      .where(and(eq(researchProjects.id, id), eq(researchProjects.userId, user.id)))
      .returning();
    if (!deleted[0]) {
      return res.status(404).json({ error: 'Project not found or access denied.' });
    }
    await logUserActivity(user.id, 'project_deleted', `Deleted project "${deleted[0].projectName}"`);
    res.json({ deleted: deleted[0] });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete research project.' });
  }
});

// ---------- DATASET MANAGEMENT & UPLOAD ----------
app.get('/api/datasets', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const rows = await db
      .select()
      .from(datasets)
      .where(eq(datasets.userId, user.id))
      .orderBy(desc(datasets.createdAt));
    res.json({ datasets: rows });
  } catch (error) {
    console.error('Datasets list error:', error);
    res.status(500).json({ error: 'Failed to load datasets.' });
  }
});

app.post('/api/datasets/upload', requireAuth, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No eDNA dataset file was attached.' });
    }

    const fileFormat = detectFileFormat(file.originalname);
    if (!fileFormat) {
      return res.status(400).json({
        error:
          'Unsupported file format. Accepted extensions: .fasta, .fa, .fastq, .fq, .csv, .tsv, .xlsx, .json.',
      });
    }

    const settings = await db.select().from(applicationSettings);
    const maxMbStr = settings.find((s) => s.settingName === 'max_upload_size_mb')?.settingValue;
    const maxBytes = (maxMbStr ? Number(maxMbStr) : 25) * 1024 * 1024;
    if (file.size > maxBytes) {
      return res.status(400).json({
        error: `File exceeds configured limit of ${maxMbStr || 25} MB.`,
      });
    }

    const body = req.body as {
      projectId?: string;
      sampleType?: string;
      samplingLocation?: string;
      country?: string;
      region?: string;
      collectionDate?: string;
      latitude?: string;
      longitude?: string;
      description?: string;
      temperatureC?: string;
      pH?: string;
      salinityPpt?: string;
      dissolvedOxygenMgL?: string;
      depthM?: string;
      notes?: string;
    };

    if (!body.projectId) {
      return res.status(400).json({ error: 'Please select or create a research project first.' });
    }

    const projRows = await db
      .select()
      .from(researchProjects)
      .where(and(eq(researchProjects.id, body.projectId), eq(researchProjects.userId, user.id)))
      .limit(1);
    if (!projRows[0]) {
      return res.status(404).json({ error: 'Selected research project not found.' });
    }

    // Parse file contents cleanly on server
    const parsed = parseUploadedDatasetBuffer(file.buffer, fileFormat, 'SITE_01');
    if (parsed.records.length === 0) {
      return res.status(400).json({
        error: parsed.warnings[0] || 'Uploaded file contained no parseable sequence or taxon rows.',
      });
    }

    // Write raw file safely to confined storage
    const safeBase = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_');
    const storageRel = `${user.id}/${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeBase}`;
    const fullDiskPath = safeResolveWithin(UPLOAD_DIR, storageRel);
    fs.mkdirSync(path.dirname(fullDiskPath), { recursive: true });
    fs.writeFileSync(fullDiskPath, file.buffer);

    const lat = body.latitude && !Number.isNaN(Number(body.latitude)) ? Number(body.latitude) : null;
    const lon =
      body.longitude && !Number.isNaN(Number(body.longitude)) ? Number(body.longitude) : null;

    const envCond = {
      ...(body.temperatureC ? { temperatureC: Number(body.temperatureC) } : {}),
      ...(body.pH ? { pH: Number(body.pH) } : {}),
      ...(body.salinityPpt ? { salinityPpt: Number(body.salinityPpt) } : {}),
      ...(body.dissolvedOxygenMgL ? { dissolvedOxygenMgL: Number(body.dissolvedOxygenMgL) } : {}),
      ...(body.depthM ? { depthM: Number(body.depthM) } : {}),
      ...(body.notes ? { notes: body.notes.slice(0, 400) } : {}),
    };

    const insertedDataset = await db
      .insert(datasets)
      .values({
        projectId: body.projectId,
        userId: user.id,
        fileName: file.originalname.slice(0, 200),
        storagePath: storageRel,
        fileFormat,
        fileSize: file.size,
        recordCount: parsed.records.length,
        description: (body.description || '').slice(0, 1000),
        sampleType: body.sampleType || 'Water',
        samplingLocation: (body.samplingLocation || 'Unspecified Site').slice(0, 200),
        country: (body.country || '').slice(0, 100),
        region: (body.region || '').slice(0, 120),
        collectionDate: body.collectionDate || new Date().toISOString().slice(0, 10),
        latitude: lat,
        longitude: lon,
        environmentalConditions: envCond,
        processingStatus: parsed.hasPreassignedTaxonomy ? 'identified' : 'parsed',
      })
      .returning();

    const ds = insertedDataset[0];

    // Create sample rows
    const sampleIdByCode = new Map<string, string>();
    for (const sMeta of parsed.uniqueSamples) {
      const insertedSample = await db
        .insert(samples)
        .values({
          datasetId: ds.id,
          sampleCode: sMeta.sampleCode,
          samplingLocation: sMeta.samplingLocation || ds.samplingLocation,
          collectionDate: ds.collectionDate,
          latitude: sMeta.latitude ?? lat,
          longitude: sMeta.longitude ?? lon,
          sampleMetadata: {
            sampleType: ds.sampleType,
            country: ds.country,
            region: ds.region,
            environmentalConditions: envCond,
          },
        })
        .returning();
      sampleIdByCode.set(sMeta.sampleCode, insertedSample[0].id);
    }

    // Insert sequence records (batch chunks of 200)
    const seqValues = parsed.records.map((rec) => ({
      datasetId: ds.id,
      sampleId: sampleIdByCode.get(rec.sampleCode || 'SITE_01') || null,
      sequenceId: rec.sequenceId,
      sequenceData: rec.sequenceData,
      sequenceLength: rec.sequenceLength,
      gcContent: rec.gcContent,
      readCount: rec.readCount,
      qualityStatus: rec.qualityStatus,
    }));

    for (let i = 0; i < seqValues.length; i += 200) {
      await db.insert(sequences).values(seqValues.slice(i, i + 200));
    }

    // If CSV/TSV/XLSX/JSON included validated user-provided taxonomy, store taxonomic_results + auto-compute biodiversity
    if (parsed.hasPreassignedTaxonomy) {
      const taxValues = parsed.records
        .filter((r) => r.importedTaxonomy)
        .map((r) => ({
          datasetId: ds.id,
          sampleId: sampleIdByCode.get(r.sampleCode || 'SITE_01') || null,
          sequenceId: r.sequenceId,
          markerGene: 'Imported Table',
          referenceDatabase: 'User-Provided Taxonomic Table',
          kingdom: r.importedTaxonomy!.kingdom,
          phylum: r.importedTaxonomy!.phylum,
          taxonomicClass: r.importedTaxonomy!.taxonomicClass,
          taxonomicOrder: r.importedTaxonomy!.taxonomicOrder,
          family: r.importedTaxonomy!.family,
          genus: r.importedTaxonomy!.genus,
          species: r.importedTaxonomy!.species,
          percentIdentity: r.importedTaxonomy!.percentIdentity ?? 100,
          queryCoverage: r.importedTaxonomy!.queryCoverage ?? 100,
          eValue: 'N/A',
          referenceAccession: r.importedTaxonomy!.referenceAccession ?? 'USER_TABLE',
          confidenceScore: r.importedTaxonomy!.confidenceScore ?? 1.0,
          abundanceCount: r.readCount,
          identificationStatus: 'imported_table',
          matchSource: 'user_provided_table',
        }));

      for (let i = 0; i < taxValues.length; i += 200) {
        await db.insert(taxonomicResults).values(taxValues.slice(i, i + 200));
      }
    }

    await db.insert(notifications).values({
      userId: user.id,
      title: 'Dataset Upload Completed',
      message: `${ds.fileName} (${ds.recordCount} records) uploaded and ${parsed.hasPreassignedTaxonomy ? 'ingested with taxonomic assignments' : 'parsed for sequence identification'}.`,
      category: 'upload',
      status: 'unread',
    });

    await logUserActivity(
      user.id,
      'dataset_uploaded',
      `Uploaded ${ds.fileName} (${ds.fileFormat}, ${ds.recordCount} records)`
    );

    res.status(201).json({
      dataset: ds,
      warnings: parsed.warnings,
      hasPreassignedTaxonomy: parsed.hasPreassignedTaxonomy,
    });
  } catch (error: any) {
    console.error('Dataset upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload and parse dataset.' });
  }
});

app.get('/api/datasets/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { id } = req.params;
    const dsRows = await db.select().from(datasets).where(eq(datasets.id, id)).limit(1);
    const ds = dsRows[0];
    if (!ds || (ds.userId !== user.id && user.role !== 'admin')) {
      return res.status(404).json({ error: 'Dataset not found or access denied.' });
    }
    const [dsSamples, dsSequences] = await Promise.all([
      db.select().from(samples).where(eq(samples.datasetId, id)),
      db.select().from(sequences).where(eq(sequences.datasetId, id)).limit(100),
    ]);
    res.json({ dataset: ds, samples: dsSamples, sequences: dsSequences });
  } catch (error) {
    console.error('Dataset detail error:', error);
    res.status(500).json({ error: 'Failed to retrieve dataset details.' });
  }
});

app.get('/api/datasets/:id/download', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { id } = req.params;
    const dsRows = await db.select().from(datasets).where(eq(datasets.id, id)).limit(1);
    const ds = dsRows[0];
    if (!ds || (ds.userId !== user.id && user.role !== 'admin')) {
      return res.status(404).json({ error: 'Dataset not found or access denied.' });
    }
    const resolved = safeResolveWithin(UPLOAD_DIR, ds.storagePath);
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'Stored dataset file not found on disk.' });
    }
    res.download(resolved, ds.fileName);
  } catch (error) {
    console.error('Download dataset error:', error);
    res.status(500).json({ error: 'Failed to download dataset.' });
  }
});

app.delete('/api/datasets/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { id } = req.params;
    const dsRows = await db.select().from(datasets).where(eq(datasets.id, id)).limit(1);
    const ds = dsRows[0];
    if (!ds || ds.userId !== user.id) {
      return res.status(404).json({ error: 'Dataset not found or unauthorized.' });
    }
    try {
      const resolved = safeResolveWithin(UPLOAD_DIR, ds.storagePath);
      if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
    } catch {
      // Ignore cleanup if already absent
    }
    await db.delete(datasets).where(eq(datasets.id, id));
    await logUserActivity(user.id, 'dataset_deleted', `Deleted dataset "${ds.fileName}"`);
    res.json({ deletedId: id });
  } catch (error) {
    console.error('Delete dataset error:', error);
    res.status(500).json({ error: 'Failed to delete dataset.' });
  }
});

// ---------- TAXONOMIC IDENTIFICATION ----------
app.post('/api/analysis/taxonomic', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const {
      datasetId,
      markerGene = '12S rRNA',
      referenceDatabase = 'NCBI GenBank',
      minIdentity = 85,
      minCoverage = 60,
      customReferenceFasta = '',
    } = req.body as {
      datasetId?: string;
      markerGene?: string;
      referenceDatabase?: string;
      minIdentity?: number;
      minCoverage?: number;
      customReferenceFasta?: string;
    };

    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId is required.' });
    }

    const dsRows = await db.select().from(datasets).where(eq(datasets.id, datasetId)).limit(1);
    const ds = dsRows[0];
    if (!ds || ds.userId !== user.id) {
      return res.status(404).json({ error: 'Dataset not found or unauthorized.' });
    }

    const seqRows = await db.select().from(sequences).where(eq(sequences.datasetId, datasetId));
    if (seqRows.length === 0) {
      return res.status(400).json({ error: 'No sequences found in this dataset.' });
    }

    const jobRow = await db
      .insert(analysisJobs)
      .values({
        userId: user.id,
        datasetId,
        analysisType: 'taxonomic_identification',
        parameters: { markerGene, referenceDatabase, minIdentity, minCoverage },
        status: 'running',
      })
      .returning();
    const job = jobRow[0];

    await db
      .update(datasets)
      .set({ processingStatus: 'analyzing' })
      .where(eq(datasets.id, datasetId));

    await db.insert(notifications).values({
      userId: user.id,
      title: 'Taxonomic Analysis Started',
      message: `Processing ${seqRows.length} sequences from ${ds.fileName} against ${referenceDatabase} (${markerGene}).`,
      category: 'analysis',
      status: 'unread',
    });

    const identified = identifySequences(seqRows, {
      markerGene,
      referenceDatabase,
      minIdentity: Number(minIdentity),
      minCoverage: Number(minCoverage),
      customReferenceFasta,
    });

    // Replace previous taxonomic_results for this dataset
    await db.delete(taxonomicResults).where(eq(taxonomicResults.datasetId, datasetId));
    for (let i = 0; i < identified.length; i += 200) {
      await db.insert(taxonomicResults).values(
        identified.slice(i, i + 200).map((item) => ({
          ...item,
          datasetId,
        }))
      );
    }

    await db
      .update(datasets)
      .set({ processingStatus: 'identified' })
      .where(eq(datasets.id, datasetId));

    await db
      .update(analysisJobs)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(analysisJobs.id, job.id));

    const matchedCount = identified.filter((r) => r.identificationStatus === 'matched').length;

    await db.insert(notifications).values({
      userId: user.id,
      title: 'Taxonomic Identification Completed',
      message: `${ds.fileName}: ${matchedCount}/${identified.length} sequences matched above ${minIdentity}% identity.`,
      category: 'analysis',
      status: 'unread',
    });

    await logUserActivity(
      user.id,
      'taxonomic_analysis_completed',
      `Identified ${matchedCount}/${identified.length} sequences in ${ds.fileName} (${markerGene} / ${referenceDatabase})`
    );

    res.json({
      jobId: job.id,
      results: identified,
      summary: {
        total: identified.length,
        matched: matchedCount,
        lowConfidence: identified.filter((r) => r.identificationStatus === 'low_confidence').length,
        unassigned: identified.filter((r) => r.identificationStatus === 'unassigned').length,
        engineMode: customReferenceFasta.trim()
          ? 'user_reference_fasta'
          : 'local_curated_voucher_kmer',
      },
    });
  } catch (error: any) {
    console.error('Taxonomic identification error:', error);
    res.status(500).json({ error: error.message || 'Taxonomic identification failed.' });
  }
});

app.get('/api/analysis/taxonomic/:datasetId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { datasetId } = req.params;
    const dsRows = await db.select().from(datasets).where(eq(datasets.id, datasetId)).limit(1);
    if (!dsRows[0] || (dsRows[0].userId !== user.id && user.role !== 'admin')) {
      return res.status(404).json({ error: 'Dataset not found or unauthorized.' });
    }
    const results = await db
      .select()
      .from(taxonomicResults)
      .where(eq(taxonomicResults.datasetId, datasetId));
    res.json({ dataset: dsRows[0], results });
  } catch (error) {
    console.error('Fetch taxonomic results error:', error);
    res.status(500).json({ error: 'Failed to load taxonomic identification results.' });
  }
});

app.get('/api/analysis/jobs', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const jobs = await db
      .select()
      .from(analysisJobs)
      .where(eq(analysisJobs.userId, user.id))
      .orderBy(desc(analysisJobs.startedAt))
      .limit(30);
    res.json({ jobs });
  } catch (error) {
    console.error('Fetch jobs error:', error);
    res.status(500).json({ error: 'Failed to load analysis jobs.' });
  }
});

// ---------- BIODIVERSITY ASSESSMENT ----------
app.post('/api/analysis/biodiversity', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { datasetId } = req.body as { datasetId?: string };
    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId is required.' });
    }
    const dsRows = await db.select().from(datasets).where(eq(datasets.id, datasetId)).limit(1);
    const ds = dsRows[0];
    if (!ds || ds.userId !== user.id) {
      return res.status(404).json({ error: 'Dataset not found or unauthorized.' });
    }

    const [taxRows, sampleRows] = await Promise.all([
      db.select().from(taxonomicResults).where(eq(taxonomicResults.datasetId, datasetId)),
      db.select().from(samples).where(eq(samples.datasetId, datasetId)),
    ]);

    const sampleLabelMap = new Map(sampleRows.map((s) => [s.id, s.sampleCode]));
    const inputs: TaxonAbundanceInput[] = taxRows.map((t) => ({
      sampleId: t.sampleId,
      sampleLabel: (t.sampleId && sampleLabelMap.get(t.sampleId)) || ds.samplingLocation || 'SITE_01',
      kingdom: t.kingdom,
      phylum: t.phylum,
      taxonomicClass: t.taxonomicClass,
      taxonomicOrder: t.taxonomicOrder,
      family: t.family,
      genus: t.genus,
      species: t.species,
      abundanceCount: t.abundanceCount,
      identificationStatus: t.identificationStatus,
    }));

    const assessment = calculateBiodiversityAssessment(inputs);
    if (!assessment.valid) {
      return res.status(400).json({ error: assessment.validationError, assessment });
    }

    // Persist computed biodiversity results to PostgreSQL
    await db.delete(biodiversityResults).where(eq(biodiversityResults.datasetId, datasetId));
    const toInsert = [assessment.datasetAlpha, ...assessment.sampleAlphas].map((m) => ({
      datasetId,
      sampleId: m.sampleId,
      sampleLabel: m.sampleLabel,
      richness: m.richness,
      totalIndividuals: m.totalIndividuals,
      shannonIndex: m.shannonIndex,
      simpsonIndex: m.simpsonIndex,
      pielouEvenness: m.pielouEvenness,
      chao1Estimate: m.chao1Estimate,
      calculationNotes: m.calculationNotes,
    }));
    await db.insert(biodiversityResults).values(toInsert);

    await db.insert(analysisJobs).values({
      userId: user.id,
      datasetId,
      analysisType: 'biodiversity_assessment',
      parameters: { samplesCount: assessment.sampleAlphas.length },
      status: 'completed',
      completedAt: new Date(),
    });

    await logUserActivity(
      user.id,
      'biodiversity_assessed',
      `Computed alpha/beta diversity for ${ds.fileName} (Richness S=${assessment.datasetAlpha.richness}, H'=${assessment.datasetAlpha.shannonIndex})`
    );

    res.json({ assessment });
  } catch (error: any) {
    console.error('Biodiversity assessment error:', error);
    res.status(500).json({ error: error.message || 'Biodiversity assessment failed.' });
  }
});

app.get('/api/analysis/biodiversity/:datasetId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { datasetId } = req.params;
    const dsRows = await db.select().from(datasets).where(eq(datasets.id, datasetId)).limit(1);
    const ds = dsRows[0];
    if (!ds || (ds.userId !== user.id && user.role !== 'admin')) {
      return res.status(404).json({ error: 'Dataset not found or unauthorized.' });
    }

    const [taxRows, sampleRows] = await Promise.all([
      db.select().from(taxonomicResults).where(eq(taxonomicResults.datasetId, datasetId)),
      db.select().from(samples).where(eq(samples.datasetId, datasetId)),
    ]);

    const sampleLabelMap = new Map(sampleRows.map((s) => [s.id, s.sampleCode]));
    const inputs: TaxonAbundanceInput[] = taxRows.map((t) => ({
      sampleId: t.sampleId,
      sampleLabel: (t.sampleId && sampleLabelMap.get(t.sampleId)) || ds.samplingLocation || 'SITE_01',
      kingdom: t.kingdom,
      phylum: t.phylum,
      taxonomicClass: t.taxonomicClass,
      taxonomicOrder: t.taxonomicOrder,
      family: t.family,
      genus: t.genus,
      species: t.species,
      abundanceCount: t.abundanceCount,
      identificationStatus: t.identificationStatus,
    }));

    const assessment = calculateBiodiversityAssessment(inputs);
    res.json({ dataset: ds, assessment });
  } catch (error) {
    console.error('Fetch biodiversity error:', error);
    res.status(500).json({ error: 'Failed to retrieve biodiversity assessment.' });
  }
});

// ---------- GEOGRAPHIC VISUALIZATION ----------
app.get('/api/geography/sites', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { country, region, sampleType, collectionDate, search } = req.query as Record<
      string,
      string | undefined
    >;

    const userDatasets = await db
      .select()
      .from(datasets)
      .where(eq(datasets.userId, user.id))
      .orderBy(desc(datasets.createdAt));

    const filteredDatasets = userDatasets.filter((ds) => {
      if (country && !ds.country.toLowerCase().includes(country.toLowerCase())) return false;
      if (region && !ds.region.toLowerCase().includes(region.toLowerCase())) return false;
      if (sampleType && sampleType !== 'All' && ds.sampleType !== sampleType) return false;
      if (collectionDate && !ds.collectionDate.includes(collectionDate)) return false;
      if (
        search &&
        !ds.samplingLocation.toLowerCase().includes(search.toLowerCase()) &&
        !ds.fileName.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    const dsIds = filteredDatasets.map((d) => d.id);
    if (dsIds.length === 0) {
      return res.json({ sites: [] });
    }

    const [sampleRows, taxRows, bioRows] = await Promise.all([
      db
        .select()
        .from(samples)
        .where(sql`${samples.datasetId} = ANY(${dsIds})`),
      db
        .select()
        .from(taxonomicResults)
        .where(sql`${taxonomicResults.datasetId} = ANY(${dsIds})`),
      db
        .select()
        .from(biodiversityResults)
        .where(sql`${biodiversityResults.datasetId} = ANY(${dsIds})`),
    ]);

    const dsById = new Map(filteredDatasets.map((d) => [d.id, d]));

    const sites = sampleRows
      .filter((s) => s.latitude !== null && s.longitude !== null)
      .map((s) => {
        const ds = dsById.get(s.datasetId)!;
        const siteTaxa = taxRows.filter(
          (t) => t.datasetId === s.datasetId && (t.sampleId === s.id || t.sampleId === null)
        );
        const siteBio =
          bioRows.find((b) => b.sampleId === s.id) ||
          bioRows.find((b) => b.datasetId === s.datasetId && b.sampleId === null) ||
          null;

        const speciesList = Array.from(
          new Set(siteTaxa.filter((t) => t.species !== 'Unassigned').map((t) => t.species))
        ).slice(0, 10);

        return {
          id: s.id,
          datasetId: ds.id,
          datasetName: ds.fileName,
          sampleCode: s.sampleCode,
          samplingLocation: s.samplingLocation,
          collectionDate: s.collectionDate,
          sampleType: ds.sampleType,
          country: ds.country,
          region: ds.region,
          latitude: s.latitude!,
          longitude: s.longitude!,
          richness: siteBio?.richness ?? speciesList.length,
          shannonIndex: siteBio?.shannonIndex ?? 0,
          simpsonIndex: siteBio?.simpsonIndex ?? 0,
          topTaxa: speciesList,
          environmentalConditions: ds.environmentalConditions,
        };
      });

    res.json({ sites });
  } catch (error) {
    console.error('Geography sites error:', error);
    res.status(500).json({ error: 'Failed to load geographic sampling sites.' });
  }
});

app.post('/api/geography/sites', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { datasetId, sampleCode, samplingLocation, collectionDate, latitude, longitude } =
      req.body as {
        datasetId?: string;
        sampleCode?: string;
        samplingLocation?: string;
        collectionDate?: string;
        latitude?: number;
        longitude?: number;
      };

    if (!datasetId || !sampleCode || !samplingLocation || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'All sampling location and GPS fields are required.' });
    }

    const dsRows = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, datasetId), eq(datasets.userId, user.id)))
      .limit(1);
    if (!dsRows[0]) {
      return res.status(404).json({ error: 'Dataset not found or unauthorized.' });
    }

    const inserted = await db
      .insert(samples)
      .values({
        datasetId,
        sampleCode: sampleCode.trim().slice(0, 60),
        samplingLocation: samplingLocation.trim().slice(0, 160),
        collectionDate: collectionDate || dsRows[0].collectionDate,
        latitude: Number(latitude),
        longitude: Number(longitude),
        sampleMetadata: { addedManually: true },
      })
      .returning();

    res.status(201).json({ site: inserted[0] });
  } catch (error) {
    console.error('Add site error:', error);
    res.status(500).json({ error: 'Failed to add sampling site.' });
  }
});

// ---------- GEMINI AI RESEARCH ASSISTANT ----------
app.post('/api/ai/chat', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { message, datasetId, history = [] } = req.body as {
      message?: string;
      datasetId?: string;
      history?: Array<{ role: 'user' | 'model'; text: string }>;
    };

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Please enter a scientific question.' });
    }

    let context: AssistantDatasetContext | null = null;
    if (datasetId) {
      const bundle = await getDatasetContextForUser(datasetId, user.id, user.role === 'admin');
      if (bundle) context = bundle.context;
    }

    const result = await askResearchAssistant(message.trim(), history, context);
    await logUserActivity(
      user.id,
      'ai_assistant_query',
      `Queried eDNA Research Assistant${context ? ` on ${context.datasetName}` : ''}`
    );
    res.json(result);
  } catch (error: any) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: error.message || 'AI Research Assistant request failed.' });
  }
});

app.post('/api/ai/interpret', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { datasetId } = req.body as { datasetId?: string };
    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId is required.' });
    }
    const bundle = await getDatasetContextForUser(datasetId, user.id, user.role === 'admin');
    if (!bundle) {
      return res.status(404).json({ error: 'Dataset not found or unauthorized.' });
    }
    const interpretation = await generateReportInterpretation(bundle.context);
    res.json({ interpretation });
  } catch (error: any) {
    console.error('AI interpret error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate AI interpretation.' });
  }
});

// ---------- REPORT GENERATION ----------
app.get('/api/reports', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const rows = await db
      .select()
      .from(generatedReports)
      .where(eq(generatedReports.userId, user.id))
      .orderBy(desc(generatedReports.createdAt));
    res.json({ reports: rows });
  } catch (error) {
    console.error('Reports list error:', error);
    res.status(500).json({ error: 'Failed to load report history.' });
  }
});

app.post('/api/reports', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { datasetId, reportName, reportFormat } = req.body as {
      datasetId?: string;
      reportName?: string;
      reportFormat?: 'PDF' | 'XLSX' | 'CSV';
    };

    if (!datasetId || !reportName || !reportFormat) {
      return res.status(400).json({ error: 'datasetId, reportName, and reportFormat are required.' });
    }

    const dsRows = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, datasetId), eq(datasets.userId, user.id)))
      .limit(1);
    if (!dsRows[0]) {
      return res.status(404).json({ error: 'Dataset not found or unauthorized.' });
    }

    const inserted = await db
      .insert(generatedReports)
      .values({
        userId: user.id,
        datasetId,
        reportName: reportName.slice(0, 180),
        reportFormat,
        storagePath: `generated://${datasetId}/${Date.now()}.${reportFormat.toLowerCase()}`,
        engineVersion: 'eDNA-BioStats 1.0.0',
      })
      .returning();

    await db.insert(notifications).values({
      userId: user.id,
      title: 'Scientific Report Generated',
      message: `${reportName} (${reportFormat}) has been logged to your report archive.`,
      category: 'report',
      status: 'unread',
    });

    await logUserActivity(user.id, 'report_generated', `Generated ${reportFormat} report: ${reportName}`);
    res.status(201).json({ report: inserted[0] });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Failed to record generated report.' });
  }
});

// ---------- HIDDEN ADMINISTRATOR CONTROL PANEL (/api/admin/*) ----------
app.get('/api/admin/status', requireFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const adminCount = await countAdmins();
    const envPasscode = process.env.ADMIN_CONTROL_PASSCODE;
    const configRows = await db.select().from(adminSecurityConfig).limit(1);
    const hasConfiguredPasscode = Boolean(
      (envPasscode && envPasscode.trim().length > 0) || configRows[0]
    );
    const dbUser = await getUserByUid(req.firebaseUser!.uid);
    res.json({
      hasConfiguredPasscode,
      adminCount,
      isCurrentUserAdmin: dbUser?.role === 'admin',
      userEmail: req.firebaseUser!.email || null,
    });
  } catch (error) {
    console.error('Admin status error:', error);
    res.status(500).json({ error: 'Failed to check administrator panel status.' });
  }
});

app.post('/api/admin/bootstrap', requireFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const rateKey = `${req.ip}_${req.firebaseUser!.uid}`;
    if (!checkAdminRateLimit(rateKey)) {
      return res.status(429).json({ error: 'Too many attempts. Wait 60 seconds.' });
    }

    const envPasscode = process.env.ADMIN_CONTROL_PASSCODE;
    if (envPasscode && envPasscode.trim().length > 0) {
      return res.status(409).json({
        error: 'Server environment passcode is already configured via ADMIN_CONTROL_PASSCODE.',
      });
    }

    const existingConfig = await db.select().from(adminSecurityConfig).limit(1);
    const adminCount = await countAdmins();
    if (existingConfig[0] || adminCount > 0) {
      return res.status(409).json({
        error: 'Administrator control panel has already been claimed.',
      });
    }

    const { passcode } = req.body as { passcode?: string };
    if (!passcode || passcode.length < 10) {
      return res.status(400).json({
        error: 'Administrator control passcode must be at least 10 characters.',
      });
    }

    const decoded = req.firebaseUser!;
    const { user } = await getOrCreateUser({
      uid: decoded.uid,
      email: decoded.email || `${decoded.uid}@admin.local`,
      emailVerified: Boolean(decoded.email_verified),
      fullName: decoded.name || 'Platform Administrator',
      userCategory: 'Scientist',
    });

    const { salt, hash } = hashPasscode(passcode);
    await db.insert(adminSecurityConfig).values({
      passcodeHash: hash,
      salt,
      claimedByUid: decoded.uid,
    });

    const promoted = await db
      .update(users)
      .set({ role: 'admin', accountStatus: 'active', updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();

    const adminToken = signAdminToken(decoded.uid, promoted[0].email);
    await db.insert(adminAuditLogs).values({
      adminUserId: promoted[0].id,
      adminEmail: promoted[0].email,
      action: 'admin_panel_claimed',
      targetType: 'system',
      details: 'Initial administrator claimed /secure-control-panel and established hashed control passcode.',
      ipAddress: req.ip,
    });

    res.json({ adminToken, adminUser: promoted[0] });
  } catch (error) {
    console.error('Admin bootstrap error:', error);
    res.status(500).json({ error: 'Failed to initialize administrator control panel.' });
  }
});

app.post('/api/admin/verify', requireFirebaseToken, async (req: AuthRequest, res) => {
  try {
    const rateKey = `${req.ip}_${req.firebaseUser!.uid}`;
    if (!checkAdminRateLimit(rateKey)) {
      return res.status(429).json({ error: 'Too many authentication attempts. Try again later.' });
    }

    const decoded = req.firebaseUser!;
    const { passcode } = req.body as { passcode?: string };
    if (!passcode) {
      return res.status(400).json({ error: 'Administrator passcode is required.' });
    }

    const envPasscode = process.env.ADMIN_CONTROL_PASSCODE;
    let passcodeValid = false;

    if (envPasscode && envPasscode.trim().length > 0) {
      const a = Buffer.from(passcode);
      const b = Buffer.from(envPasscode.trim());
      passcodeValid = a.length === b.length && crypto.timingSafeEqual(a, b);
    } else {
      const configRows = await db.select().from(adminSecurityConfig).limit(1);
      if (!configRows[0]) {
        return res.status(400).json({
          error: 'Administrator passcode is not configured yet. Complete initial setup.',
        });
      }
      passcodeValid = verifyPasscodeHash(passcode, configRows[0].salt, configRows[0].passcodeHash);
    }

    if (!passcodeValid) {
      await db.insert(adminAuditLogs).values({
        adminEmail: decoded.email || decoded.uid,
        action: 'admin_login_failed',
        targetType: 'auth',
        details: 'Invalid administrator control passcode attempt.',
        ipAddress: req.ip,
      });
      return res.status(403).json({ error: 'Invalid administrator credentials.' });
    }

    const dbUser = await getUserByUid(decoded.uid);
    if (!dbUser) {
      return res.status(403).json({
        error: 'No authorized administrator record exists for this account.',
      });
    }

    // If env passcode was used by the project owner or an existing admin, verify role
    let effectiveUser = dbUser;
    if (dbUser.role !== 'admin') {
      // Only allow automatic elevation if an explicit server env passcode was provided AND verified
      if (envPasscode && envPasscode.trim().length > 0) {
        const updated = await db
          .update(users)
          .set({ role: 'admin', updatedAt: new Date() })
          .where(eq(users.id, dbUser.id))
          .returning();
        effectiveUser = updated[0];
      } else {
        await db.insert(adminAuditLogs).values({
          adminUserId: dbUser.id,
          adminEmail: dbUser.email,
          action: 'unauthorized_admin_attempt',
          targetType: 'auth',
          details: 'Non-admin user attempted /secure-control-panel login.',
          ipAddress: req.ip,
        });
        return res.status(403).json({
          error: 'Forbidden: Account does not hold administrator privileges.',
        });
      }
    }

    const adminToken = signAdminToken(decoded.uid, effectiveUser.email);
    await db.insert(adminAuditLogs).values({
      adminUserId: effectiveUser.id,
      adminEmail: effectiveUser.email,
      action: 'admin_login_success',
      targetType: 'auth',
      details: 'Administrator authenticated to /secure-control-panel.',
      ipAddress: req.ip,
    });

    res.json({ adminToken, adminUser: effectiveUser });
  } catch (error) {
    console.error('Admin verify error:', error);
    res.status(500).json({ error: 'Administrator verification failed.' });
  }
});

app.get('/api/admin/overview', requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const [allUsers, allDatasets, allProjects, allJobs, storageAgg] = await Promise.all([
      db.select().from(users),
      db.select().from(datasets),
      db.select().from(researchProjects),
      db.select().from(analysisJobs),
      db.select({ totalBytes: sql<number>`COALESCE(SUM(${datasets.fileSize}), 0)::bigint` }).from(datasets),
    ]);

    res.json({
      metrics: {
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter((u) => u.accountStatus === 'active').length,
        totalDatasets: allDatasets.length,
        totalProjects: allProjects.length,
        totalAnalyses: allJobs.length,
        storageBytes: Number(storageAgg[0]?.totalBytes || 0),
      },
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to load admin overview.' });
  }
});

app.get('/api/admin/users', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { search = '', category = '' } = req.query as Record<string, string>;
    let rows = await db.select().from(users).orderBy(desc(users.createdAt));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.institution.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
      );
    }
    if (category && category !== 'All') {
      rows = rows.filter((u) => u.userCategory === category);
    }
    res.json({ users: rows });
  } catch (error) {
    console.error('Admin users list error:', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

app.patch('/api/admin/users/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const admin = req.dbUser!;
    const { id } = req.params;
    const { accountStatus, role } = req.body as {
      accountStatus?: 'active' | 'suspended' | 'deactivated';
      role?: 'user' | 'admin';
    };

    if (id === admin.id && (accountStatus === 'suspended' || role === 'user')) {
      return res.status(400).json({ error: 'Cannot suspend or demote your own active admin account.' });
    }

    const updated = await db
      .update(users)
      .set({
        ...(accountStatus ? { accountStatus } : {}),
        ...(role ? { role } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!updated[0]) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    await db.insert(adminAuditLogs).values({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: role ? 'user_role_updated' : 'user_status_updated',
      targetType: 'user',
      targetId: id,
      details: `Updated ${updated[0].email}: status=${updated[0].accountStatus}, role=${updated[0].role}`,
      ipAddress: req.ip,
    });

    res.json({ user: updated[0] });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const admin = req.dbUser!;
    const { id } = req.params;
    if (id === admin.id) {
      return res.status(400).json({ error: 'Cannot delete your own administrator account.' });
    }
    const deleted = await db.delete(users).where(eq(users.id, id)).returning();
    if (!deleted[0]) {
      return res.status(404).json({ error: 'User not found.' });
    }
    await db.insert(adminAuditLogs).values({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: 'user_deleted',
      targetType: 'user',
      targetId: id,
      details: `Deleted account ${deleted[0].email}`,
      ipAddress: req.ip,
    });
    res.json({ deletedId: id });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

app.get('/api/admin/datasets', requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        id: datasets.id,
        fileName: datasets.fileName,
        fileFormat: datasets.fileFormat,
        fileSize: datasets.fileSize,
        recordCount: datasets.recordCount,
        sampleType: datasets.sampleType,
        samplingLocation: datasets.samplingLocation,
        processingStatus: datasets.processingStatus,
        createdAt: datasets.createdAt,
        ownerEmail: users.email,
        ownerName: users.fullName,
      })
      .from(datasets)
      .leftJoin(users, eq(datasets.userId, users.id))
      .orderBy(desc(datasets.createdAt));
    res.json({ datasets: rows });
  } catch (error) {
    console.error('Admin datasets error:', error);
    res.status(500).json({ error: 'Failed to load datasets.' });
  }
});

app.delete('/api/admin/datasets/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const admin = req.dbUser!;
    const { id } = req.params;
    const dsRows = await db.select().from(datasets).where(eq(datasets.id, id)).limit(1);
    if (!dsRows[0]) return res.status(404).json({ error: 'Dataset not found.' });
    try {
      const resolved = safeResolveWithin(UPLOAD_DIR, dsRows[0].storagePath);
      if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
    } catch {
      // ignore
    }
    await db.delete(datasets).where(eq(datasets.id, id));
    await db.insert(adminAuditLogs).values({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: 'admin_dataset_deleted',
      targetType: 'dataset',
      targetId: id,
      details: `Admin removed dataset "${dsRows[0].fileName}"`,
      ipAddress: req.ip,
    });
    res.json({ deletedId: id });
  } catch (error) {
    console.error('Admin delete dataset error:', error);
    res.status(500).json({ error: 'Failed to delete dataset.' });
  }
});

app.get('/api/admin/monitoring', requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const [jobs, activities] = await Promise.all([
      db.select().from(analysisJobs).orderBy(desc(analysisJobs.startedAt)).limit(50),
      db
        .select({
          id: userActivity.id,
          action: userActivity.action,
          details: userActivity.details,
          timestamp: userActivity.timestamp,
          userEmail: users.email,
        })
        .from(userActivity)
        .leftJoin(users, eq(userActivity.userId, users.id))
        .orderBy(desc(userActivity.timestamp))
        .limit(50),
    ]);
    const aiQueriesCount = activities.filter((a) => a.action === 'ai_assistant_query').length;
    res.json({ jobs, activities, aiQueriesCount });
  } catch (error) {
    console.error('Admin monitoring error:', error);
    res.status(500).json({ error: 'Failed to load monitoring data.' });
  }
});

app.get('/api/admin/settings', requireAdmin, async (_req: AuthRequest, res) => {
  try {
    await ensureDefaultPlatformData();
    const [settings, refDbs] = await Promise.all([
      db.select().from(applicationSettings),
      db.select().from(referenceDatabases),
    ]);
    res.json({ settings, referenceDatabases: refDbs });
  } catch (error) {
    console.error('Admin settings error:', error);
    res.status(500).json({ error: 'Failed to fetch platform settings.' });
  }
});

app.patch('/api/admin/settings', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const admin = req.dbUser!;
    const { settingName, settingValue } = req.body as {
      settingName?: string;
      settingValue?: string;
    };
    if (!settingName || settingValue === undefined) {
      return res.status(400).json({ error: 'settingName and settingValue are required.' });
    }
    const updated = await db
      .update(applicationSettings)
      .set({ settingValue: String(settingValue), updatedAt: new Date() })
      .where(eq(applicationSettings.settingName, settingName))
      .returning();

    if (settingName === 'platform_announcement' && String(settingValue).trim()) {
      await db.insert(notifications).values({
        userId: null,
        title: 'Administrative Announcement',
        message: String(settingValue).trim(),
        category: 'announcement',
        status: 'unread',
      });
    }

    await db.insert(adminAuditLogs).values({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: 'setting_updated',
      targetType: 'setting',
      targetId: settingName,
      details: `Updated ${settingName} = ${settingValue}`,
      ipAddress: req.ip,
    });
    res.json({ setting: updated[0] });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting.' });
  }
});

app.patch('/api/admin/reference-databases/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const admin = req.dbUser!;
    const { id } = req.params;
    const { isActive, version } = req.body as { isActive?: boolean; version?: string };
    const updated = await db
      .update(referenceDatabases)
      .set({
        ...(isActive !== undefined ? { isActive } : {}),
        ...(version ? { version } : {}),
        updatedAt: new Date(),
      })
      .where(eq(referenceDatabases.id, id))
      .returning();
    await db.insert(adminAuditLogs).values({
      adminUserId: admin.id,
      adminEmail: admin.email,
      action: 'reference_db_updated',
      targetType: 'reference_database',
      targetId: id,
      details: `Updated reference database ${updated[0]?.name}: active=${updated[0]?.isActive}`,
      ipAddress: req.ip,
    });
    res.json({ database: updated[0] });
  } catch (error) {
    console.error('Update reference database error:', error);
    res.status(500).json({ error: 'Failed to update reference database.' });
  }
});

app.get('/api/admin/audit-logs', requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const logs = await db
      .select()
      .from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(100);
    res.json({ logs });
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// ---------- SERVER STARTUP (VITE DEV / PRODUCTION DIST) ----------
async function startServer() {
  const PORT = 3000;
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`eDNA Biodiversity Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
