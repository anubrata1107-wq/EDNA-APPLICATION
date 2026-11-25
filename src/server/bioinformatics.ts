import * as XLSX from 'xlsx';

export interface ParsedSequenceRecord {
  sequenceId: string;
  sequenceData: string;
  sequenceLength: number;
  gcContent: number;
  readCount: number;
  qualityStatus: 'passed' | 'low_quality' | 'filtered';
  sampleCode?: string;
  samplingLocation?: string;
  latitude?: number;
  longitude?: number;
  importedTaxonomy?: {
    kingdom: string;
    phylum: string;
    taxonomicClass: string;
    taxonomicOrder: string;
    family: string;
    genus: string;
    species: string;
    percentIdentity?: number;
    queryCoverage?: number;
    referenceAccession?: string;
    confidenceScore?: number;
  };
}

export interface ParsedDatasetResult {
  records: ParsedSequenceRecord[];
  uniqueSamples: Array<{
    sampleCode: string;
    samplingLocation?: string;
    latitude?: number;
    longitude?: number;
  }>;
  hasPreassignedTaxonomy: boolean;
  warnings: string[];
}

export interface ReferenceVoucher {
  accession: string;
  database: string[];
  marker: string;
  kingdom: string;
  phylum: string;
  taxonomicClass: string;
  taxonomicOrder: string;
  family: string;
  genus: string;
  species: string;
  sequence: string;
}

// Curated scientific voucher sequences across standard metabarcoding markers (16S, 18S, COI, ITS, 12S, rbcL, matK).
// Used by the local k-mer & alignment identification engine when an external BLAST+/SILVA daemon is not connected.
export const CURATED_VOUCHER_LIBRARY: ReferenceVoucher[] = [
  {
    accession: 'NC_010007.1',
    database: ['NCBI GenBank', 'MIDORI', 'BOLD Systems'],
    marker: '12S rRNA',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    taxonomicClass: 'Actinopterygii',
    taxonomicOrder: 'Salmoniformes',
    family: 'Salmonidae',
    genus: 'Salmo',
    species: 'Salmo trutta',
    sequence:
      'CAAAGGTTTGGTCCTGGCCTTACTATCAGCTCTAGTCAAATTTACACATGCAAGTATCCGCACCCCCGTGAGAATGCCCTTAATCCCCTGTTCGGGGACGAGGAGCAGGCATCAGGCACACAACTTCAGCCCAAGACGCCTTGCTTAGCCACACCCCCAAGGG',
  },
  {
    accession: 'NC_001717.1',
    database: ['NCBI GenBank', 'MIDORI', 'BOLD Systems'],
    marker: '12S rRNA',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    taxonomicClass: 'Actinopterygii',
    taxonomicOrder: 'Salmoniformes',
    family: 'Salmonidae',
    genus: 'Oncorhynchus',
    species: 'Oncorhynchus mykiss',
    sequence:
      'CAAAGGTTTGGTCCTGGCCTTACTATTAGCTCTAACTAAACTTACACATGCAAGTATCCGCACCCCTGTGAGAATGCCCTTAATCCCCTGTCCGGGGACGAGGAGCAGGCATCAGGCACACAAATTCAGCCCAAGACGCCTTGCTTAGCCACACCCCCAAGGG',
  },
  {
    accession: 'NC_002333.2',
    database: ['NCBI GenBank', 'MIDORI'],
    marker: '12S rRNA',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    taxonomicClass: 'Actinopterygii',
    taxonomicOrder: 'Cypriniformes',
    family: 'Danionidae',
    genus: 'Danio',
    species: 'Danio rerio',
    sequence:
      'GCTAGACCTTGGTCCCAGCCTTTCTATTAGCTCTAGCAAGATTAACACATGCAAGCATCCGCACCCCCGTGAGGATGCCCTCACAATCCCACTTAAGGGACGAGGAGCTGGTATCAGGCACGCAAACGTAGCCCAAGACGCCTAGCTAAGCCACACCCCCACG',
  },
  {
    accession: 'KX681533.1',
    database: ['BOLD Systems', 'NCBI GenBank', 'MIDORI'],
    marker: 'COI',
    kingdom: 'Animalia',
    phylum: 'Arthropoda',
    taxonomicClass: 'Malacostraca',
    taxonomicOrder: 'Amphipoda',
    family: 'Gammaridae',
    genus: 'Gammarus',
    species: 'Gammarus pulex',
    sequence:
      'GGTCAACAAATCATAAAGATATTGGAACTCTATATTTTATTTTTGGGGCCTGAGCAGGAATAGTAGGAACTTCTTTAAGATTACTAATTCGAGCAGAATTAGGAAACCCGGGATCTTTAATTGGAGACGATCAAATTTACAATACTATTGTTACAGCTCATGCTT',
  },
  {
    accession: 'MZ654812.1',
    database: ['BOLD Systems', 'NCBI GenBank'],
    marker: 'COI',
    kingdom: 'Animalia',
    phylum: 'Arthropoda',
    taxonomicClass: 'Insecta',
    taxonomicOrder: 'Ephemeroptera',
    family: 'Ephemeridae',
    genus: 'Ephemera',
    species: 'Ephemera danica',
    sequence:
      'AACTTTATATTTTATCTTCGGGGCTTGATCAGGAATGATTGGCACTTCCCTAAGACTTCTTATCCGGGCAGAACTGGGCCAACCCGGAGCACTCATTGGAGATGACCAGATTTACAACGTAATTGTCACAGCCCACGCCTTCATTATAATTTTCTTTATAGTTAT',
  },
  {
    accession: 'HM883947.1',
    database: ['BOLD Systems', 'NCBI GenBank'],
    marker: 'COI',
    kingdom: 'Animalia',
    phylum: 'Arthropoda',
    taxonomicClass: 'Branchiopoda',
    taxonomicOrder: 'Diplostraca',
    family: 'Daphniidae',
    genus: 'Daphnia',
    species: 'Daphnia magna',
    sequence:
      'TTTATACTTTATTTTTGGAGTTTGGGCCGGGATGGTGGGCACTTCCTTGAGAATACTAATTCGAGCTGAGTTAGGTCAGCCAGGATCCCTGATTGGAGACGATCAGATTTACAACGTAATCGTAACAGCTCATGCTTTCGTAATAATCTTCTTCATAGTAATGCCA',
  },
  {
    accession: 'JQ786024.1',
    database: ['BOLD Systems', 'NCBI GenBank', 'MIDORI'],
    marker: 'COI',
    kingdom: 'Animalia',
    phylum: 'Mollusca',
    taxonomicClass: 'Bivalvia',
    taxonomicOrder: 'Mytilida',
    family: 'Mytilidae',
    genus: 'Mytilus',
    species: 'Mytilus edulis',
    sequence:
      'GGTCAACAAATCATAAAGACATTGGAACTTTATATTTTCTTTTTGGTATTTGGTCTGGATTAGTAGGCACAGGAATGAGAGTTTTAATTCGTCTAGAGTTAGGACAGCCTGGATCTCTATTAGGAGATGATCAACTTTATAACGTTGTTGTTACCGCTCATGCATT',
  },
  {
    accession: 'NR_114476.1',
    database: ['SILVA', 'NCBI GenBank', 'MIDORI'],
    marker: '16S rRNA',
    kingdom: 'Bacteria',
    phylum: 'Pseudomonadota',
    taxonomicClass: 'Gammaproteobacteria',
    taxonomicOrder: 'Pseudomonadales',
    family: 'Pseudomonadaceae',
    genus: 'Pseudomonas',
    species: 'Pseudomonas fluorescens',
    sequence:
      'AGAGTTTGATCCTGGCTCAGATTGAACGCTGGCGGCAGGCCTAACACATGCAAGTCGAGCGGATGACGGAGCTTGCTCCTTGATTCAGCGGCGGACGGGTGAGTAATGCCTAGGAATCTGCCTGGTAGTGGGGGACAACGTTTCGAAAGGAACGCTAATACCGCATA',
  },
  {
    accession: 'NR_102783.2',
    database: ['SILVA', 'NCBI GenBank'],
    marker: '16S rRNA',
    kingdom: 'Bacteria',
    phylum: 'Bacillota',
    taxonomicClass: 'Bacilli',
    taxonomicOrder: 'Bacillales',
    family: 'Bacillaceae',
    genus: 'Bacillus',
    species: 'Bacillus subtilis',
    sequence:
      'AGAGTTTGATCCTGGCTCAGGACGAACGCTGGCGGCGTGCCTAATACATGCAAGTCGAGCGGACAGATGGGAGCTTGCTCCCTGATGTTAGCGGCGGACGGGTGAGTAACACGTGGGTAACCTGCCTGTAAGACTGGGATAACTCCGGGAAACCGGGGCTAATACCGG',
  },
  {
    accession: 'NR_115808.1',
    database: ['SILVA', 'NCBI GenBank', 'MIDORI'],
    marker: '16S rRNA',
    kingdom: 'Bacteria',
    phylum: 'Pseudomonadota',
    taxonomicClass: 'Gammaproteobacteria',
    taxonomicOrder: 'Vibrionales',
    family: 'Vibrionaceae',
    genus: 'Aliivibrio',
    species: 'Aliivibrio fischeri',
    sequence:
      'AGAGTTTGATCATGGCTCAGATTGAACGCTGGCGGCAGGCCTAACACATGCAAGTCGAGCGGAAACGAGTTATCTGAACCTTCGGGGAACGATAACGGCGTCGAGCGGCGGACGGGTGAGTAATGCCTGGGAAATTGCCCTGATGTGGGGGATAACCATTGGAAACGA',
  },
  {
    accession: 'NR_113672.1',
    database: ['SILVA', 'NCBI GenBank'],
    marker: '16S rRNA',
    kingdom: 'Bacteria',
    phylum: 'Cyanobacteriota',
    taxonomicClass: 'Cyanophyceae',
    taxonomicOrder: 'Synechococcales',
    family: 'Prochlorococcaceae',
    genus: 'Prochlorococcus',
    species: 'Prochlorococcus marinus',
    sequence:
      'GCTGGCGGTATGCCTAACACATGCAAGTCGAACGGGCTTTTAGGAGCTTGCTCCTTAAGAGTGGCGAACGGGTGAGTAACGCGTGAGAATCTGCCTTCAGGAGGGGGACAACAGTTGGAAACGACTGCTAATACCCCATATGCTGAGGGTGAAAGATTTTTGCCTGAGG',
  },
  {
    accession: 'XR_003738122.1',
    database: ['SILVA', 'NCBI GenBank'],
    marker: '18S rRNA',
    kingdom: 'Protista',
    phylum: 'Chlorophyta',
    taxonomicClass: 'Chlorophyceae',
    taxonomicOrder: 'Chlamydomonadales',
    family: 'Chlamydomonadaceae',
    genus: 'Chlamydomonas',
    species: 'Chlamydomonas reinhardtii',
    sequence:
      'TACCTGGTTGATCCTGCCAGTAGTCATATGCTTGTCTCAAAGATTAAGCCATGCATGTCTAAGTATAAACTGCTTTATACTGTGAAACTGCGAATGGCTCATTAAATCAGTTATAGTTTATTTGATGGTACCTACTACTCGGATAACCGTAGTAATTCTAGAGCTAATAC',
  },
  {
    accession: 'NR_111007.1',
    database: ['UNITE', 'NCBI GenBank'],
    marker: 'ITS',
    kingdom: 'Fungi',
    phylum: 'Ascomycota',
    taxonomicClass: 'Saccharomycetes',
    taxonomicOrder: 'Saccharomycetales',
    family: 'Saccharomycetaceae',
    genus: 'Saccharomyces',
    species: 'Saccharomyces cerevisiae',
    sequence:
      'TCCGTAGGTGAACCTGCGGAAGGATCATTAAAGAAATTTAATAATTTTGAAAATGGATTTTTTTTTGTTTTGGCAAGAGCATGAGAGCTTTTACTGGGCAAGAAGACAAGAGATGGAGAGTCCAGCCGGGCCTGCGCTTAAGTGCGCGGTCTTGCTAGGCTTGTAAGTT',
  },
  {
    accession: 'NR_144914.1',
    database: ['UNITE', 'NCBI GenBank'],
    marker: 'ITS',
    kingdom: 'Fungi',
    phylum: 'Ascomycota',
    taxonomicClass: 'Sordariomycetes',
    taxonomicOrder: 'Hypocreales',
    family: 'Hypocreaceae',
    genus: 'Trichoderma',
    species: 'Trichoderma harzianum',
    sequence:
      'TCCGTAGGTGAACCTGCGGAAGGATCATTACCGAGTTTACAACTCCCAAACCCAATGTGAACGTTACCAAACTGTTGCCTCGGCGGGGTCACGCCCCGGGTGCGTCGCAGCCCCGGAACCAGGCGCCCGCCGGAGGAACCAACCAAACTCTTTCTGTAGTCCCCTCG',
  },
  {
    accession: 'NC_044861.1',
    database: ['BOLD Systems', 'NCBI GenBank'],
    marker: 'rbcL',
    kingdom: 'Plantae',
    phylum: 'Tracheophyta',
    taxonomicClass: 'Magnoliopsida',
    taxonomicOrder: 'Alismatales',
    family: 'Zosteraceae',
    genus: 'Zostera',
    species: 'Zostera marina',
    sequence:
      'ATGTCACCACAAACAGAGACTAAAGCAAGTGTTGGATTCAAAGCTGGTGTTAAAGAGTATAAATTGACTTATTATACTCCTGAGTATGAAACCAAAGATACTGATATCTTGGCAGCATTCCGAGTAACTCCTCAACCCGGAGTTCCACCTGAAGAAGCAGGGGCTGCGG',
  },
  {
    accession: 'NC_020091.1',
    database: ['BOLD Systems', 'NCBI GenBank'],
    marker: 'matK',
    kingdom: 'Plantae',
    phylum: 'Tracheophyta',
    taxonomicClass: 'Magnoliopsida',
    taxonomicOrder: 'Fagales',
    family: 'Fagaceae',
    genus: 'Quercus',
    species: 'Quercus robur',
    sequence:
      'ATGGAGGAAATTCAAGGATATTTAGAGATAGATTCACGTCAACAACATGATTTTCTATACCCTCTTTTCTTCCGGGAGTATATTTATGCACTTGCTCATGATCATGGTTTAAATAGATCGATTTTGTACAAAAATCCGGGATATTGGGTCTATGATAATAAATCCGGTT',
  },
];

function computeGc(seq: string): number {
  if (!seq.length) return 0;
  let gc = 0;
  for (let i = 0; i < seq.length; i++) {
    const ch = seq[i];
    if (ch === 'G' || ch === 'C') gc++;
  }
  return Number(((gc / seq.length) * 100).toFixed(2));
}

function evaluateSequenceQuality(seq: string, meanPhred?: number): 'passed' | 'low_quality' | 'filtered' {
  if (seq.length < 40) return 'filtered';
  const nCount = (seq.match(/N/g) || []).length;
  if (nCount / seq.length > 0.15) return 'low_quality';
  if (meanPhred !== undefined && meanPhred < 20) return 'low_quality';
  return 'passed';
}

function extractHeaderMetadata(header: string) {
  const sampleMatch = header.match(/sample[=:]\s*([A-Za-z0-9_.-]+)/i);
  const locMatch = header.match(/location[=:]\s*"?([^";]+)"?/i);
  const readsMatch = header.match(/(?:size|reads|count)[=:]\s*(\d+)/i);
  const latMatch = header.match(/lat[=:]\s*(-?\d+(?:\.\d+)?)/i);
  const lonMatch = header.match(/(?:lon|lng)[=:]\s*(-?\d+(?:\.\d+)?)/i);
  return {
    sampleCode: sampleMatch ? sampleMatch[1] : undefined,
    samplingLocation: locMatch ? locMatch[1].trim() : undefined,
    readCount: readsMatch ? Math.max(1, parseInt(readsMatch[1], 10)) : 1,
    latitude: latMatch ? parseFloat(latMatch[1]) : undefined,
    longitude: lonMatch ? parseFloat(lonMatch[1]) : undefined,
  };
}

export function parseFastaText(content: string, defaultSampleCode = 'SAMPLE_01'): ParsedDatasetResult {
  const lines = content.split(/\r?\n/);
  const records: ParsedSequenceRecord[] = [];
  const warnings: string[] = [];
  const sampleMap = new Map<string, { sampleCode: string; samplingLocation?: string; latitude?: number; longitude?: number }>();

  let currentHeader = '';
  let currentSeq = '';

  const flush = () => {
    if (!currentHeader) return;
    const cleanSeq = currentSeq.toUpperCase().replace(/[^ACGTURYSWKMBDHVN]/g, '');
    const idToken = currentHeader.split(/\s+/)[0].replace(/^>/, '') || `SEQ_${records.length + 1}`;
    const meta = extractHeaderMetadata(currentHeader);
    const sampleCode = meta.sampleCode || defaultSampleCode;
    if (!sampleMap.has(sampleCode)) {
      sampleMap.set(sampleCode, {
        sampleCode,
        samplingLocation: meta.samplingLocation,
        latitude: meta.latitude,
        longitude: meta.longitude,
      });
    }
    if (cleanSeq.length > 0) {
      records.push({
        sequenceId: idToken,
        sequenceData: cleanSeq,
        sequenceLength: cleanSeq.length,
        gcContent: computeGc(cleanSeq),
        readCount: meta.readCount,
        qualityStatus: evaluateSequenceQuality(cleanSeq),
        sampleCode,
        samplingLocation: meta.samplingLocation,
        latitude: meta.latitude,
        longitude: meta.longitude,
      });
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('>')) {
      flush();
      currentHeader = line.slice(1).trim();
      currentSeq = '';
    } else {
      currentSeq += line;
    }
  }
  flush();

  if (records.length === 0) {
    warnings.push('No valid FASTA sequence entries starting with ">" were detected.');
  }

  return {
    records,
    uniqueSamples: Array.from(sampleMap.values()),
    hasPreassignedTaxonomy: false,
    warnings,
  };
}

export function parseFastqText(content: string, defaultSampleCode = 'SAMPLE_01'): ParsedDatasetResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const records: ParsedSequenceRecord[] = [];
  const warnings: string[] = [];
  const sampleMap = new Map<string, { sampleCode: string; samplingLocation?: string; latitude?: number; longitude?: number }>();

  for (let i = 0; i + 3 < lines.length; i += 4) {
    const headerLine = lines[i].trim();
    const seqLine = lines[i + 1].trim().toUpperCase().replace(/[^ACGTURYSWKMBDHVN]/g, '');
    const plusLine = lines[i + 2].trim();
    const qualLine = lines[i + 3].trim();

    if (!headerLine.startsWith('@') || !plusLine.startsWith('+')) {
      warnings.push(`Malformed FASTQ block near line ${i + 1}; skipped.`);
      continue;
    }

    let phredSum = 0;
    for (let j = 0; j < qualLine.length; j++) {
      phredSum += Math.max(0, qualLine.charCodeAt(j) - 33);
    }
    const meanPhred = qualLine.length > 0 ? phredSum / qualLine.length : 0;
    const header = headerLine.slice(1).trim();
    const idToken = header.split(/\s+/)[0] || `READ_${records.length + 1}`;
    const meta = extractHeaderMetadata(header);
    const sampleCode = meta.sampleCode || defaultSampleCode;
    if (!sampleMap.has(sampleCode)) {
      sampleMap.set(sampleCode, {
        sampleCode,
        samplingLocation: meta.samplingLocation,
        latitude: meta.latitude,
        longitude: meta.longitude,
      });
    }

    records.push({
      sequenceId: idToken,
      sequenceData: seqLine,
      sequenceLength: seqLine.length,
      gcContent: computeGc(seqLine),
      readCount: meta.readCount,
      qualityStatus: evaluateSequenceQuality(seqLine, meanPhred),
      sampleCode,
      samplingLocation: meta.samplingLocation,
      latitude: meta.latitude,
      longitude: meta.longitude,
    });
  }

  if (records.length === 0) {
    warnings.push('No valid 4-line FASTQ blocks starting with "@" were found.');
  }

  return {
    records,
    uniqueSamples: Array.from(sampleMap.values()),
    hasPreassignedTaxonomy: false,
    warnings,
  };
}

function parseDelimitedRows(rows: Record<string, unknown>[], defaultSampleCode = 'SAMPLE_01'): ParsedDatasetResult {
  const records: ParsedSequenceRecord[] = [];
  const warnings: string[] = [];
  const sampleMap = new Map<string, { sampleCode: string; samplingLocation?: string; latitude?: number; longitude?: number }>();
  let hasPreassignedTaxonomy = false;

  const pick = (row: Record<string, unknown>, keys: string[]): string => {
    const lowerMap = new Map<string, unknown>();
    for (const [k, v] of Object.entries(row)) {
      lowerMap.set(k.trim().toLowerCase(), v);
    }
    for (const key of keys) {
      const val = lowerMap.get(key.toLowerCase());
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
    return '';
  };

  rows.forEach((row, idx) => {
    const seqId = pick(row, ['sequence_id', 'seq_id', 'otu_id', 'asv_id', 'id']) || `REC_${idx + 1}`;
    const seqData = pick(row, ['sequence', 'sequence_data', 'dna_sequence', 'seq'])
      .toUpperCase()
      .replace(/[^ACGTURYSWKMBDHVN]/g, '');
    const species = pick(row, ['species', 'taxon', 'scientific_name', 'organism']);
    const genus = pick(row, ['genus']);
    const family = pick(row, ['family']);
    const order = pick(row, ['order', 'taxonomic_order']);
    const taxClass = pick(row, ['class', 'taxonomic_class']);
    const phylum = pick(row, ['phylum']);
    const kingdom = pick(row, ['kingdom']);
    const readStr = pick(row, ['read_count', 'reads', 'abundance', 'count', 'individuals']);
    const readCount = readStr && !Number.isNaN(Number(readStr)) ? Math.max(1, Math.round(Number(readStr))) : 1;
    const sampleCode = pick(row, ['sample_code', 'sample_id', 'sample', 'site_code']) || defaultSampleCode;
    const samplingLocation = pick(row, ['sampling_location', 'location', 'site_name', 'site']) || undefined;
    const latStr = pick(row, ['latitude', 'lat']);
    const lonStr = pick(row, ['longitude', 'lon', 'lng']);
    const latitude = latStr && !Number.isNaN(Number(latStr)) ? Number(latStr) : undefined;
    const longitude = lonStr && !Number.isNaN(Number(lonStr)) ? Number(lonStr) : undefined;
    const pidStr = pick(row, ['percent_identity', 'identity', 'pident']);
    const qcovStr = pick(row, ['query_coverage', 'coverage', 'qcov']);
    const accession = pick(row, ['reference_accession', 'accession']);

    if (!sampleMap.has(sampleCode)) {
      sampleMap.set(sampleCode, { sampleCode, samplingLocation, latitude, longitude });
    }

    const hasTaxon = Boolean(species || genus || family || phylum || kingdom);
    if (hasTaxon) {
      hasPreassignedTaxonomy = true;
    }

    if (!seqData && !hasTaxon) {
      return;
    }

    const effectiveSeq = seqData || 'N'.repeat(120);
    records.push({
      sequenceId: seqId,
      sequenceData: effectiveSeq,
      sequenceLength: seqData ? seqData.length : 0,
      gcContent: seqData ? computeGc(seqData) : 0,
      readCount,
      qualityStatus: seqData ? evaluateSequenceQuality(seqData) : 'passed',
      sampleCode,
      samplingLocation,
      latitude,
      longitude,
      importedTaxonomy: hasTaxon
        ? {
            kingdom: kingdom || 'Unassigned',
            phylum: phylum || 'Unassigned',
            taxonomicClass: taxClass || 'Unassigned',
            taxonomicOrder: order || 'Unassigned',
            family: family || 'Unassigned',
            genus: genus || (species ? species.split(/\s+/)[0] : 'Unassigned'),
            species: species || 'Unassigned',
            percentIdentity: pidStr && !Number.isNaN(Number(pidStr)) ? Number(pidStr) : 100,
            queryCoverage: qcovStr && !Number.isNaN(Number(qcovStr)) ? Number(qcovStr) : 100,
            referenceAccession: accession || 'USER_TABLE',
            confidenceScore: pidStr && !Number.isNaN(Number(pidStr)) ? Number((Number(pidStr) / 100).toFixed(3)) : 1.0,
          }
        : undefined,
    });
  });

  if (records.length === 0) {
    warnings.push(
      'No valid sequence or taxonomic abundance columns found. Expected columns like sequence_id, sequence, species, abundance, sample_code.'
    );
  }

  return {
    records,
    uniqueSamples: Array.from(sampleMap.values()),
    hasPreassignedTaxonomy,
    warnings,
  };
}

export function parseUploadedDatasetBuffer(
  buffer: Buffer,
  fileFormat: string,
  defaultSampleCode = 'SAMPLE_01'
): ParsedDatasetResult {
  const fmt = fileFormat.toUpperCase();
  if (fmt === 'FASTA') {
    return parseFastaText(buffer.toString('utf8'), defaultSampleCode);
  }
  if (fmt === 'FASTQ') {
    return parseFastqText(buffer.toString('utf8'), defaultSampleCode);
  }
  if (fmt === 'JSON') {
    try {
      const parsed = JSON.parse(buffer.toString('utf8'));
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.records)
          ? parsed.records
          : Array.isArray(parsed?.sequences)
            ? parsed.sequences
            : [parsed];
      return parseDelimitedRows(arr as Record<string, unknown>[], defaultSampleCode);
    } catch {
      return {
        records: [],
        uniqueSamples: [],
        hasPreassignedTaxonomy: false,
        warnings: ['Invalid JSON structure in uploaded file.'],
      };
    }
  }
  if (fmt === 'CSV' || fmt === 'TSV' || fmt === 'XLSX') {
    try {
      const workbook =
        fmt === 'XLSX'
          ? XLSX.read(buffer, { type: 'buffer' })
          : XLSX.read(buffer.toString('utf8'), {
              type: 'string',
              FS: fmt === 'TSV' ? '\t' : ',',
            });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) {
        return {
          records: [],
          uniqueSamples: [],
          hasPreassignedTaxonomy: false,
          warnings: ['Workbook contains no readable sheets.'],
        };
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet]);
      return parseDelimitedRows(rows, defaultSampleCode);
    } catch {
      return {
        records: [],
        uniqueSamples: [],
        hasPreassignedTaxonomy: false,
        warnings: [`Failed to parse ${fmt} tabular data.`],
      };
    }
  }
  return {
    records: [],
    uniqueSamples: [],
    hasPreassignedTaxonomy: false,
    warnings: [`Unsupported file format: ${fileFormat}`],
  };
}

function getKmers(seq: string, k = 7): Set<string> {
  const kmers = new Set<string>();
  if (seq.length < k) return kmers;
  for (let i = 0; i <= seq.length - k; i++) {
    const sub = seq.slice(i, i + k);
    if (!sub.includes('N')) kmers.add(sub);
  }
  return kmers;
}

// Compute actual local k-mer containment + optimal ungapped/shifted alignment identity
function alignSequences(query: string, ref: string): { percentIdentity: number; queryCoverage: number; eValue: string } {
  const qLen = query.length;
  const rLen = ref.length;
  if (qLen === 0 || rLen === 0) {
    return { percentIdentity: 0, queryCoverage: 0, eValue: '1.0' };
  }

  // Try sliding window offset alignment to find best overlap identity
  let bestMatches = 0;
  let bestOverlap = 0;

  for (let shift = -(rLen - 30); shift <= qLen - 30; shift += 1) {
    const qStart = Math.max(0, shift);
    const rStart = Math.max(0, -shift);
    const overlap = Math.min(qLen - qStart, rLen - rStart);
    if (overlap < 30) continue;

    let matches = 0;
    for (let i = 0; i < overlap; i++) {
      if (query[qStart + i] === ref[rStart + i]) matches++;
    }
    if (matches > bestMatches) {
      bestMatches = matches;
      bestOverlap = overlap;
    }
  }

  // Also check 7-mer Jaccard containment for indel resilience
  const qKmers = getKmers(query, 7);
  const rKmers = getKmers(ref, 7);
  let sharedKmers = 0;
  for (const km of qKmers) {
    if (rKmers.has(km)) sharedKmers++;
  }
  const kmerContainment = qKmers.size > 0 ? sharedKmers / Math.min(qKmers.size, rKmers.size || 1) : 0;

  const ungappedId = bestOverlap > 0 ? (bestMatches / bestOverlap) * 100 : 0;
  const kmerApproxId = kmerContainment > 0 ? Math.min(100, Math.pow(kmerContainment, 1 / 5) * 100) : 0;
  const percentIdentity = Number(Math.max(ungappedId, kmerApproxId).toFixed(2));
  const queryCoverage = Number(Math.min(100, ((bestOverlap > 0 ? bestOverlap : sharedKmers + 6) / qLen) * 100).toFixed(2));

  // Deterministic Karlin-Altschul style E-value approximation against reference length
  const bitScore = Math.max(0, (percentIdentity / 100) * (bestOverlap || qLen) * 1.4 - 12);
  const rawE = (qLen * rLen * Math.pow(2, -bitScore)) / 10;
  const eValue = rawE < 1e-180 ? '0.0' : rawE < 0.001 ? rawE.toExponential(2) : rawE.toFixed(3);

  return { percentIdentity, queryCoverage, eValue };
}

export interface TaxonomicIdentificationParams {
  markerGene: string;
  referenceDatabase: string;
  minIdentity: number;
  minCoverage: number;
  customReferenceFasta?: string;
}

export interface IdentifiedTaxonRecord {
  sequenceId: string;
  sampleId: string | null;
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
  identificationStatus: 'matched' | 'low_confidence' | 'unassigned';
  matchSource: 'local_voucher_kmer' | 'user_reference_fasta' | 'unassigned';
}

export function identifySequences(
  seqRows: Array<{
    sequenceId: string;
    sampleId: string | null;
    sequenceData: string;
    readCount: number;
    qualityStatus: string;
  }>,
  params: TaxonomicIdentificationParams
): IdentifiedTaxonRecord[] {
  // Build active reference pool
  let activeRefs: ReferenceVoucher[] = CURATED_VOUCHER_LIBRARY.filter(
    (v) =>
      (v.marker.toLowerCase() === params.markerGene.toLowerCase() || params.markerGene === 'All Markers') &&
      (v.database.includes(params.referenceDatabase) || params.referenceDatabase === 'All Databases')
  );

  let matchSourceKind: 'local_voucher_kmer' | 'user_reference_fasta' = 'local_voucher_kmer';

  // If user uploaded custom reference FASTA (>ACCESSION Kingdom;Phylum;Class;Order;Family;Genus;Species)
  if (params.customReferenceFasta && params.customReferenceFasta.trim().length > 0) {
    const customParsed = parseFastaText(params.customReferenceFasta, 'REF');
    const customRefs: ReferenceVoucher[] = [];
    const lines = params.customReferenceFasta.split(/\r?\n/).filter((l) => l.startsWith('>'));
    customParsed.records.forEach((rec, i) => {
      const header = lines[i] || `>${rec.sequenceId}`;
      const lineageText = header.replace(/^>\S+\s*/, '');
      const parts = lineageText.split(';').map((s) => s.trim());
      customRefs.push({
        accession: rec.sequenceId,
        database: [params.referenceDatabase],
        marker: params.markerGene,
        kingdom: parts[0] || 'Unassigned',
        phylum: parts[1] || 'Unassigned',
        taxonomicClass: parts[2] || 'Unassigned',
        taxonomicOrder: parts[3] || 'Unassigned',
        family: parts[4] || 'Unassigned',
        genus: parts[5] || 'Unassigned',
        species: parts[6] || rec.sequenceId,
        sequence: rec.sequenceData,
      });
    });
    if (customRefs.length > 0) {
      activeRefs = customRefs;
      matchSourceKind = 'user_reference_fasta';
    }
  }

  return seqRows.map((seq) => {
    if (seq.qualityStatus === 'filtered' || !seq.sequenceData || seq.sequenceData.replace(/N/g, '').length < 30) {
      return {
        sequenceId: seq.sequenceId,
        sampleId: seq.sampleId,
        markerGene: params.markerGene,
        referenceDatabase: params.referenceDatabase,
        kingdom: 'Unassigned',
        phylum: 'Unassigned',
        taxonomicClass: 'Unassigned',
        taxonomicOrder: 'Unassigned',
        family: 'Unassigned',
        genus: 'Unassigned',
        species: 'Unassigned',
        percentIdentity: 0,
        queryCoverage: 0,
        eValue: 'N/A',
        referenceAccession: 'N/A',
        confidenceScore: 0,
        abundanceCount: seq.readCount,
        identificationStatus: 'unassigned',
        matchSource: 'unassigned',
      };
    }

    let bestRef: ReferenceVoucher | null = null;
    let bestScore = { percentIdentity: 0, queryCoverage: 0, eValue: '1.0' };

    for (const ref of activeRefs) {
      const alignment = alignSequences(seq.sequenceData, ref.sequence);
      if (alignment.percentIdentity > bestScore.percentIdentity) {
        bestScore = alignment;
        bestRef = ref;
      }
    }

    if (!bestRef || bestScore.percentIdentity < 65 || bestScore.queryCoverage < 35) {
      return {
        sequenceId: seq.sequenceId,
        sampleId: seq.sampleId,
        markerGene: params.markerGene,
        referenceDatabase: params.referenceDatabase,
        kingdom: 'Unassigned',
        phylum: 'Unassigned',
        taxonomicClass: 'Unassigned',
        taxonomicOrder: 'Unassigned',
        family: 'Unassigned',
        genus: 'Unassigned',
        species: 'Unassigned',
        percentIdentity: bestScore.percentIdentity,
        queryCoverage: bestScore.queryCoverage,
        eValue: bestScore.eValue,
        referenceAccession: 'NO_LOCAL_MATCH',
        confidenceScore: Number((bestScore.percentIdentity / 100).toFixed(3)),
        abundanceCount: seq.readCount,
        identificationStatus: 'unassigned',
        matchSource: 'unassigned',
      };
    }

    const meetsThreshold =
      bestScore.percentIdentity >= params.minIdentity &&
      bestScore.queryCoverage >= params.minCoverage;

    const confidence = Number(
      Math.min(1, (bestScore.percentIdentity * 0.7 + bestScore.queryCoverage * 0.3) / 100).toFixed(3)
    );

    return {
      sequenceId: seq.sequenceId,
      sampleId: seq.sampleId,
      markerGene: params.markerGene,
      referenceDatabase: params.referenceDatabase,
      kingdom: bestRef.kingdom,
      phylum: bestRef.phylum,
      taxonomicClass: bestRef.taxonomicClass,
      taxonomicOrder: bestRef.taxonomicOrder,
      family: bestRef.family,
      genus: bestRef.genus,
      species: meetsThreshold ? bestRef.species : `${bestRef.genus} sp.`,
      percentIdentity: bestScore.percentIdentity,
      queryCoverage: bestScore.queryCoverage,
      eValue: bestScore.eValue,
      referenceAccession: bestRef.accession,
      confidenceScore: confidence,
      abundanceCount: seq.readCount,
      identificationStatus: meetsThreshold ? 'matched' : 'low_confidence',
      matchSource: matchSourceKind,
    };
  });
}

export function buildSampleFastaDataset(): string {
  return `>SEQ_RIV_001 sample=SITE_UPPER_STREAM location="Upper Cascade Reach" lat=47.4241 lon=-121.4112 size=42
CAAAGGTTTGGTCCTGGCCTTACTATCAGCTCTAGTCAAATTTACACATGCAAGTATCCGCACCCCCGTGAGAATGCCCTTAATCCCCTGTTCGGGGACGAGGAGCAGGCATCAGGCACACAACTTCAGCCCAAGACGCCTTGCTTAGCCACACCCCCAAGGG
>SEQ_RIV_002 sample=SITE_UPPER_STREAM location="Upper Cascade Reach" lat=47.4241 lon=-121.4112 size=28
CAAAGGTTTGGTCCTGGCCTTACTATTAGCTCTAACTAAACTTACACATGCAAGTATCCGCACCCCTGTGAGAATGCCCTTAATCCCCTGTCCGGGGACGAGGAGCAGGCATCAGGCACACAAATTCAGCCCAAGACGCCTTGCTTAGCCACACCCCCAAGGG
>SEQ_RIV_003 sample=SITE_UPPER_STREAM location="Upper Cascade Reach" lat=47.4241 lon=-121.4112 size=19
GCTAGACCTTGGTCCCAGCCTTTCTATTAGCTCTAGCAAGATTAACACATGCAAGCATCCGCACCCCCGTGAGGATGCCCTCACAATCCCACTTAAGGGACGAGGAGCTGGTATCAGGCACGCAAACGTAGCCCAAGACGCCTAGCTAAGCCACACCCCCACG
>SEQ_RIV_004 sample=SITE_MID_VALLEY location="Mid-Valley Riffle" lat=47.3910 lon=-121.5220 size=35
CAAAGGTTTGGTCCTGGCCTTACTATCAGCTCTAGTCAAATTTACACATGCAAGTATCCGCACCCCCGTGAGAATGCCCTTAATCCCCTGTTCGGGGACGAGGAGCAGGCATCAGGCACACAACTTCAGCCCAAGACGCCTTGCTTAGCCACACCCCCAAGGG
>SEQ_RIV_005 sample=SITE_MID_VALLEY location="Mid-Valley Riffle" lat=47.3910 lon=-121.5220 size=14
GCTAGACCTTGGTCCCAGCCTTTCTATTAGCTCTAGCAAGATTAACACATGCAAGCATCCGCACCCCCGTGAGGATGCCCTCACAATCCCACTTAAGGGACGAGGAGCTGGTATCAGGCACGCAAACGTAGCCCAAGACGCCTAGCTAAGCCACACCCCCACG
>SEQ_RIV_006 sample=SITE_ESTUARY_MOUTH location="Estuary Tidal Basin" lat=47.5512 lon=-122.3490 size=51
GCTAGACCTTGGTCCCAGCCTTTCTATTAGCTCTAGCAAGATTAACACATGCAAGCATCCGCACCCCCGTGAGGATGCCCTCACAATCCCACTTAAGGGACGAGGAGCTGGTATCAGGCACGCAAACGTAGCCCAAGACGCCTAGCTAAGCCACACCCCCACG
>SEQ_RIV_007 sample=SITE_ESTUARY_MOUTH location="Estuary Tidal Basin" lat=47.5512 lon=-122.3490 size=9
CAAAGGTTTGGTCCTGGCCTTACTATTAGCTCTAACTAAACTTACACATGCAAGTATCCGCACCCCTGTGAGAATGCCCTTAATCCCCTGTCCGGGGACGAGGAGCAGGCATCAGGCACACAAATTCAGCCCAAGACGCCTTGCTTAGCCACACCCCCAAGGG
`;
}

export function buildSampleCsvDataset(): string {
  return [
    'sequence_id,sample_code,sampling_location,latitude,longitude,kingdom,phylum,class,order,family,genus,species,abundance,percent_identity,query_coverage,reference_accession',
    'ASV_01,EST_NORTH,North Mangrove Creek,1.4481,103.7292,Animalia,Chordata,Actinopterygii,Salmoniformes,Salmonidae,Salmo,Salmo trutta,38,99.4,98.5,NC_010007.1',
    'ASV_02,EST_NORTH,North Mangrove Creek,1.4481,103.7292,Animalia,Arthropoda,Malacostraca,Amphipoda,Gammaridae,Gammarus,Gammarus pulex,64,98.8,97.2,KX681533.1',
    'ASV_03,EST_NORTH,North Mangrove Creek,1.4481,103.7292,Bacteria,Pseudomonadota,Gammaproteobacteria,Vibrionales,Vibrionaceae,Aliivibrio,Aliivibrio fischeri,112,99.1,99.0,NR_115808.1',
    'ASV_04,EST_NORTH,North Mangrove Creek,1.4481,103.7292,Plantae,Tracheophyta,Magnoliopsida,Alismatales,Zosteraceae,Zostera,Zostera marina,27,99.6,96.8,NC_044861.1',
    'ASV_05,EST_SOUTH,South Seagrass Shoal,1.3912,103.8114,Animalia,Mollusca,Bivalvia,Mytilida,Mytilidae,Mytilus,Mytilus edulis,53,98.9,98.1,JQ786024.1',
    'ASV_06,EST_SOUTH,South Seagrass Shoal,1.3912,103.8114,Plantae,Tracheophyta,Magnoliopsida,Alismatales,Zosteraceae,Zostera,Zostera marina,84,99.7,99.2,NC_044861.1',
    'ASV_07,EST_SOUTH,South Seagrass Shoal,1.3912,103.8114,Bacteria,Cyanobacteriota,Cyanophyceae,Synechococcales,Prochlorococcaceae,Prochlorococcus,Prochlorococcus marinus,95,98.4,97.6,NR_113672.1',
    'ASV_08,EST_SOUTH,South Seagrass Shoal,1.3912,103.8114,Animalia,Arthropoda,Branchiopoda,Diplostraca,Daphniidae,Daphnia,Daphnia magna,12,97.9,96.4,HM883947.1',
    'ASV_09,EST_EAST,East Coral Channel,1.4125,103.9410,Bacteria,Pseudomonadota,Gammaproteobacteria,Vibrionales,Vibrionaceae,Aliivibrio,Aliivibrio fischeri,76,99.3,98.7,NR_115808.1',
    'ASV_10,EST_EAST,East Coral Channel,1.4125,103.9410,Protista,Chlorophyta,Chlorophyceae,Chlamydomonadales,Chlamydomonadaceae,Chlamydomonas,Chlamydomonas reinhardtii,45,98.6,97.9,XR_003738122.1',
    'ASV_11,EST_EAST,East Coral Channel,1.4125,103.9410,Fungi,Ascomycota,Sordariomycetes,Hypocreales,Hypocreaceae,Trichoderma,Trichoderma harzianum,9,97.5,95.8,NR_144914.1',
    'ASV_12,EST_EAST,East Coral Channel,1.4125,103.9410,Animalia,Mollusca,Bivalvia,Mytilida,Mytilidae,Mytilus,Mytilus edulis,31,99.0,98.4,JQ786024.1',
  ].join('\n');
}
