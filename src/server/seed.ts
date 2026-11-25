import { db } from '../db/index.ts';
import { applicationSettings, referenceDatabases } from '../db/schema.ts';

let seededOnce = false;

export async function ensureDefaultPlatformData() {
  if (seededOnce) return;
  try {
    const defaultDbs = [
      {
        name: 'SILVA',
        markerRegions: ['16S rRNA', '18S rRNA'],
        version: 'v138.1 (Local Curated Voucher Subset)',
        connectionMode: 'built_in_curated_vouchers',
        isActive: true,
        description:
          'Ribosomal RNA gene reference taxonomy (16S/18S SSU). Uses built-in curated voucher sequences locally; external SILVA server not connected.',
      },
      {
        name: 'NCBI GenBank',
        markerRegions: ['16S rRNA', '18S rRNA', 'COI', 'ITS', '12S rRNA', 'rbcL', 'matK'],
        version: 'RefSeq Curated Subset (Local)',
        connectionMode: 'built_in_curated_vouchers',
        isActive: true,
        description:
          'Multi-locus nucleotide reference subset. Matches against verified local voucher sequences or user-uploaded reference FASTA.',
      },
      {
        name: 'BOLD Systems',
        markerRegions: ['COI', 'rbcL', 'matK'],
        version: 'BOLD Barcode Subset (Local)',
        connectionMode: 'built_in_curated_vouchers',
        isActive: true,
        description:
          'Animal COI and plant barcode reference vouchers for freshwater, marine, and terrestrial fauna/flora.',
      },
      {
        name: 'UNITE',
        markerRegions: ['ITS'],
        version: 'v9.0 Fungal ITS Subset (Local)',
        connectionMode: 'built_in_curated_vouchers',
        isActive: true,
        description:
          'Fungal internal transcribed spacer (ITS) molecular identification reference vouchers.',
      },
      {
        name: 'MIDORI',
        markerRegions: ['12S rRNA', 'COI', '16S rRNA'],
        version: 'MIDORI2 Vertebrate mtDNA Subset (Local)',
        connectionMode: 'built_in_curated_vouchers',
        isActive: true,
        description:
          'Mitochondrial DNA reference database specialized for vertebrate aquatic eDNA metabarcoding.',
      },
    ];

    for (const refDb of defaultDbs) {
      await db
        .insert(referenceDatabases)
        .values(refDb)
        .onConflictDoNothing({ target: referenceDatabases.name });
    }

    const defaultSettings = [
      {
        settingName: 'max_upload_size_mb',
        settingValue: '25',
        description: 'Maximum file size in megabytes permitted for uploaded eDNA datasets.',
      },
      {
        settingName: 'default_min_identity',
        settingValue: '85',
        description: 'Default minimum percentage sequence identity threshold for taxonomic match.',
      },
      {
        settingName: 'platform_announcement',
        settingValue:
          'Local k-mer voucher alignment engine active. Upload FASTA/FASTQ/CSV/TSV/XLSX/JSON eDNA datasets or download sample verification datasets from the Upload module.',
        description: 'Platform-wide scientific notice displayed to researchers.',
      },
      {
        settingName: 'analysis_engine_mode',
        settingValue: 'local_curated_voucher_engine',
        description: 'Active taxonomic assignment backend (local curated voucher vs external BLAST+).',
      },
    ];

    for (const setting of defaultSettings) {
      await db
        .insert(applicationSettings)
        .values(setting)
        .onConflictDoNothing({ target: applicationSettings.settingName });
    }

    seededOnce = true;
  } catch (error) {
    console.error('Failed to ensure default platform data:', error);
  }
}
