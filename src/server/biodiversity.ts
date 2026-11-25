export interface TaxonAbundanceInput {
  sampleId: string | null;
  sampleLabel: string;
  kingdom: string;
  phylum: string;
  taxonomicClass: string;
  taxonomicOrder: string;
  family: string;
  genus: string;
  species: string;
  abundanceCount: number;
  identificationStatus: string;
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

export interface BetaMatrixEntry {
  rowSample: string;
  colSample: string;
  brayCurtisDissimilarity: number;
  jaccardDissimilarity: number;
  jaccardSimilarity: number;
}

export interface PCoAPoint {
  sampleLabel: string;
  pc1: number;
  pc2: number;
  richness: number;
  shannonIndex: number;
}

export interface TaxonRankBucket {
  name: string;
  abundance: number;
  relativeAbundancePct: number;
  taxaCount: number;
}

export interface BiodiversityAssessmentOutput {
  valid: boolean;
  validationError?: string;
  datasetAlpha: AlphaDiversityMetrics;
  sampleAlphas: AlphaDiversityMetrics[];
  betaMatrix: BetaMatrixEntry[];
  sampleNames: string[];
  pcoa: {
    points: PCoAPoint[];
    varianceExplainedPct: [number, number];
    note: string;
  };
  compositionByRank: {
    kingdom: TaxonRankBucket[];
    phylum: TaxonRankBucket[];
    class: TaxonRankBucket[];
    order: TaxonRankBucket[];
    family: TaxonRankBucket[];
    genus: TaxonRankBucket[];
    species: TaxonRankBucket[];
  };
  rareAndDominant: {
    dominant: Array<{ species: string; abundance: number; relativePct: number }>;
    rare: Array<{ species: string; abundance: number; relativePct: number }>;
  };
  methodology: {
    formulas: Array<{ metric: string; formula: string; assumption: string }>;
    inputRecordsUsed: number;
    excludedUnassignedRecords: number;
  };
}

function computeAlphaFromSpeciesCounts(
  speciesCounts: Map<string, number>,
  sampleId: string | null,
  sampleLabel: string
): AlphaDiversityMetrics {
  const counts = Array.from(speciesCounts.values()).filter((c) => c > 0);
  const richness = counts.length;
  const totalIndividuals = counts.reduce((acc, c) => acc + c, 0);

  if (richness === 0 || totalIndividuals === 0) {
    return {
      sampleId,
      sampleLabel,
      richness: 0,
      totalIndividuals: 0,
      shannonIndex: 0,
      simpsonIndex: 0,
      pielouEvenness: 0,
      chao1Estimate: null,
      calculationNotes: 'No validated identified taxa with positive abundance.',
    };
  }

  let shannon = 0;
  for (const n of counts) {
    const p = n / totalIndividuals;
    shannon -= p * Math.log(p);
  }

  let simpsonComplement = 0;
  if (totalIndividuals > 1) {
    let sumNiNiMinus1 = 0;
    for (const n of counts) {
      sumNiNiMinus1 += n * (n - 1);
    }
    simpsonComplement = 1 - sumNiNiMinus1 / (totalIndividuals * (totalIndividuals - 1));
  } else {
    simpsonComplement = 0;
  }

  const pielou = richness > 1 ? shannon / Math.log(richness) : 0;

  // Bias-corrected Chao1 estimator: S_obs + f1*(f1 - 1) / (2*(f2 + 1))
  const f1 = counts.filter((c) => c === 1).length;
  const f2 = counts.filter((c) => c === 2).length;
  const chao1 =
    richness >= 2 && totalIndividuals >= 5
      ? Number((richness + (f1 * (f1 - 1)) / (2 * (f2 + 1))).toFixed(3))
      : null;

  return {
    sampleId,
    sampleLabel,
    richness,
    totalIndividuals,
    shannonIndex: Number(shannon.toFixed(4)),
    simpsonIndex: Number(simpsonComplement.toFixed(4)),
    pielouEvenness: Number(pielou.toFixed(4)),
    chao1Estimate: chao1,
    calculationNotes:
      chao1 === null
        ? 'Chao1 omitted because sample has < 2 observed species or < 5 total individuals.'
        : `Computed from ${richness} observed taxa across ${totalIndividuals} abundance counts (f1=${f1}, f2=${f2}).`,
  };
}

// Symmetric Jacobi eigenvalue decomposition for PCoA classical multidimensional scaling
function computeTop2PCoA(distMatrix: number[][]): {
  coords: Array<[number, number]>;
  varPct: [number, number];
} {
  const n = distMatrix.length;
  if (n < 2) {
    return { coords: n === 1 ? [[0, 0]] : [], varPct: [0, 0] };
  }
  if (n === 2) {
    const d = distMatrix[0][1];
    return {
      coords: [
        [-d / 2, 0],
        [d / 2, 0],
      ],
      varPct: [100, 0],
    };
  }

  // Gower double-centering: B = -0.5 * J * D^2 * J
  const d2 = distMatrix.map((row) => row.map((v) => v * v));
  const rowMeans = d2.map((row) => row.reduce((a, b) => a + b, 0) / n);
  const grandMean = rowMeans.reduce((a, b) => a + b, 0) / n;

  const B: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      B[i][j] = -0.5 * (d2[i][j] - rowMeans[i] - rowMeans[j] + grandMean);
    }
  }

  // Jacobi rotations on symmetric n x n matrix B
  const A = B.map((r) => [...r]);
  const V: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => (i === j ? 1 : 0))
  );

  for (let iter = 0; iter < 50 * n * n; iter++) {
    let p = 0;
    let q = 1;
    let maxVal = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const absVal = Math.abs(A[i][j]);
        if (absVal > maxVal) {
          maxVal = absVal;
          p = i;
          q = j;
        }
      }
    }
    if (maxVal < 1e-10) break;

    const app = A[p][p];
    const aqq = A[q][q];
    const apq = A[p][q];
    const tau = (aqq - app) / (2 * apq);
    const t = tau >= 0 ? 1 / (tau + Math.sqrt(1 + tau * tau)) : -1 / (-tau + Math.sqrt(1 + tau * tau));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;

    A[p][p] = app - t * apq;
    A[q][q] = aqq + t * apq;
    A[p][q] = 0;
    A[q][p] = 0;

    for (let r = 0; r < n; r++) {
      if (r !== p && r !== q) {
        const arp = A[r][p];
        const arq = A[r][q];
        A[r][p] = c * arp - s * arq;
        A[p][r] = A[r][p];
        A[r][q] = s * arp + c * arq;
        A[q][r] = A[r][q];
      }
      const vrp = V[r][p];
      const vrq = V[r][q];
      V[r][p] = c * vrp - s * vrq;
      V[r][q] = s * vrp + c * vrq;
    }
  }

  const eigenPairs = Array.from({ length: n }, (_, i) => ({
    val: A[i][i],
    vec: V.map((row) => row[i]),
  })).sort((a, b) => b.val - a.val);

  const positiveSum = eigenPairs.reduce((acc, e) => acc + (e.val > 0 ? e.val : 0), 0) || 1;
  const lam1 = Math.max(0, eigenPairs[0]?.val ?? 0);
  const lam2 = Math.max(0, eigenPairs[1]?.val ?? 0);

  const coords: Array<[number, number]> = Array.from({ length: n }, (_, i) => [
    Number((Math.sqrt(lam1) * (eigenPairs[0]?.vec[i] ?? 0)).toFixed(4)),
    Number((Math.sqrt(lam2) * (eigenPairs[1]?.vec[i] ?? 0)).toFixed(4)),
  ]);

  return {
    coords,
    varPct: [
      Number(((lam1 / positiveSum) * 100).toFixed(1)),
      Number(((lam2 / positiveSum) * 100).toFixed(1)),
    ],
  };
}

function buildRankBuckets(
  rows: TaxonAbundanceInput[],
  extractor: (r: TaxonAbundanceInput) => string,
  totalAbundance: number
): TaxonRankBucket[] {
  const map = new Map<string, { abundance: number; taxa: Set<string> }>();
  for (const r of rows) {
    const label = extractor(r) || 'Unassigned';
    const cur = map.get(label) || { abundance: 0, taxa: new Set<string>() };
    cur.abundance += r.abundanceCount;
    cur.taxa.add(r.species || label);
    map.set(label, cur);
  }
  return Array.from(map.entries())
    .map(([name, info]) => ({
      name,
      abundance: info.abundance,
      relativeAbundancePct: totalAbundance > 0 ? Number(((info.abundance / totalAbundance) * 100).toFixed(2)) : 0,
      taxaCount: info.taxa.size,
    }))
    .sort((a, b) => b.abundance - a.abundance);
}

export function calculateBiodiversityAssessment(
  rows: TaxonAbundanceInput[]
): BiodiversityAssessmentOutput {
  const validRows = rows.filter(
    (r) =>
      r.identificationStatus !== 'unassigned' &&
      r.species &&
      r.species !== 'Unassigned' &&
      Number.isFinite(r.abundanceCount) &&
      r.abundanceCount > 0
  );
  const excludedUnassignedRecords = rows.length - validRows.length;

  if (validRows.length === 0) {
    return {
      valid: false,
      validationError:
        'Cannot compute biodiversity indices: no validated taxonomic identifications with positive abundance counts exist for this dataset. Run Taxonomic Identification or upload a validated taxonomic abundance table first.',
      datasetAlpha: {
        sampleId: null,
        sampleLabel: 'Dataset Aggregate',
        richness: 0,
        totalIndividuals: 0,
        shannonIndex: 0,
        simpsonIndex: 0,
        pielouEvenness: 0,
        chao1Estimate: null,
        calculationNotes: 'Insufficient validated data.',
      },
      sampleAlphas: [],
      betaMatrix: [],
      sampleNames: [],
      pcoa: {
        points: [],
        varianceExplainedPct: [0, 0],
        note: 'PCoA requires at least 2 distinct samples with identified taxa.',
      },
      compositionByRank: {
        kingdom: [],
        phylum: [],
        class: [],
        order: [],
        family: [],
        genus: [],
        species: [],
      },
      rareAndDominant: { dominant: [], rare: [] },
      methodology: {
        formulas: [],
        inputRecordsUsed: 0,
        excludedUnassignedRecords,
      },
    };
  }

  // Aggregate species counts dataset-wide & per-sample
  const globalSpeciesMap = new Map<string, number>();
  const sampleSpeciesMap = new Map<string, { sampleId: string | null; counts: Map<string, number> }>();

  for (const r of validRows) {
    globalSpeciesMap.set(r.species, (globalSpeciesMap.get(r.species) || 0) + r.abundanceCount);
    const sKey = r.sampleLabel || 'Default Sample';
    if (!sampleSpeciesMap.has(sKey)) {
      sampleSpeciesMap.set(sKey, { sampleId: r.sampleId, counts: new Map<string, number>() });
    }
    const entry = sampleSpeciesMap.get(sKey)!;
    entry.counts.set(r.species, (entry.counts.get(r.species) || 0) + r.abundanceCount);
  }

  const datasetAlpha = computeAlphaFromSpeciesCounts(globalSpeciesMap, null, 'Dataset Aggregate');
  const sampleAlphas: AlphaDiversityMetrics[] = [];
  for (const [label, info] of sampleSpeciesMap.entries()) {
    sampleAlphas.push(computeAlphaFromSpeciesCounts(info.counts, info.sampleId, label));
  }

  // Beta diversity matrices across samples
  const sampleNames = Array.from(sampleSpeciesMap.keys());
  const betaMatrix: BetaMatrixEntry[] = [];
  const dist2D: number[][] = Array.from({ length: sampleNames.length }, () =>
    Array(sampleNames.length).fill(0)
  );

  for (let i = 0; i < sampleNames.length; i++) {
    for (let j = 0; j < sampleNames.length; j++) {
      const aMap = sampleSpeciesMap.get(sampleNames[i])!.counts;
      const bMap = sampleSpeciesMap.get(sampleNames[j])!.counts;
      const allSpecies = new Set([...aMap.keys(), ...bMap.keys()]);

      let minSum = 0;
      let totalSum = 0;
      let sharedPresence = 0;
      for (const sp of allSpecies) {
        const ca = aMap.get(sp) || 0;
        const cb = bMap.get(sp) || 0;
        minSum += Math.min(ca, cb);
        totalSum += ca + cb;
        if (ca > 0 && cb > 0) sharedPresence++;
      }

      const brayCurtis = totalSum > 0 ? Number((1 - (2 * minSum) / totalSum).toFixed(4)) : 0;
      const jaccardSim = allSpecies.size > 0 ? Number((sharedPresence / allSpecies.size).toFixed(4)) : 0;
      const jaccardDis = Number((1 - jaccardSim).toFixed(4));

      dist2D[i][j] = brayCurtis;
      betaMatrix.push({
        rowSample: sampleNames[i],
        colSample: sampleNames[j],
        brayCurtisDissimilarity: brayCurtis,
        jaccardDissimilarity: jaccardDis,
        jaccardSimilarity: jaccardSim,
      });
    }
  }

  const pcoaResult = computeTop2PCoA(dist2D);
  const pcoaPoints: PCoAPoint[] = sampleNames.map((name, idx) => ({
    sampleLabel: name,
    pc1: pcoaResult.coords[idx]?.[0] ?? 0,
    pc2: pcoaResult.coords[idx]?.[1] ?? 0,
    richness: sampleAlphas[idx]?.richness ?? 0,
    shannonIndex: sampleAlphas[idx]?.shannonIndex ?? 0,
  }));

  const totalAbundance = validRows.reduce((s, r) => s + r.abundanceCount, 0);
  const speciesBuckets = buildRankBuckets(validRows, (r) => r.species, totalAbundance);

  const dominant = speciesBuckets
    .filter((b) => b.relativeAbundancePct >= 10)
    .map((b) => ({ species: b.name, abundance: b.abundance, relativePct: b.relativeAbundancePct }));

  const rare = speciesBuckets
    .filter((b) => b.relativeAbundancePct <= 5 || b.abundance <= 2)
    .map((b) => ({ species: b.name, abundance: b.abundance, relativePct: b.relativeAbundancePct }));

  return {
    valid: true,
    datasetAlpha,
    sampleAlphas,
    betaMatrix,
    sampleNames,
    pcoa: {
      points: pcoaPoints,
      varianceExplainedPct: pcoaResult.varPct,
      note:
        sampleNames.length < 2
          ? 'PCoA ordination requires at least 2 distinct samples; upload or assign multiple sampling sites to compare beta diversity.'
          : 'Principal Coordinate Analysis computed via classical multidimensional scaling (Gower double-centering) on Bray-Curtis dissimilarities.',
    },
    compositionByRank: {
      kingdom: buildRankBuckets(validRows, (r) => r.kingdom, totalAbundance),
      phylum: buildRankBuckets(validRows, (r) => r.phylum, totalAbundance),
      class: buildRankBuckets(validRows, (r) => r.taxonomicClass, totalAbundance),
      order: buildRankBuckets(validRows, (r) => r.taxonomicOrder, totalAbundance),
      family: buildRankBuckets(validRows, (r) => r.family, totalAbundance),
      genus: buildRankBuckets(validRows, (r) => r.genus, totalAbundance),
      species: speciesBuckets,
    },
    rareAndDominant: {
      dominant,
      rare,
    },
    methodology: {
      inputRecordsUsed: validRows.length,
      excludedUnassignedRecords,
      formulas: [
        {
          metric: 'Observed Species Richness (S)',
          formula: 'S = count(species with abundance n_i > 0)',
          assumption: 'Excludes unassigned sequences; depends on sequencing depth and marker specificity.',
        },
        {
          metric: "Shannon-Wiener Diversity Index (H')",
          formula: "H' = -Σ p_i * ln(p_i), where p_i = n_i / N",
          assumption: 'Natural logarithm base (e); sensitive to both species richness and relative evenness.',
        },
        {
          metric: 'Simpson Diversity Index (1 - D)',
          formula: '1 - D = 1 - [Σ n_i(n_i - 1)] / [N(N - 1)]',
          assumption: 'Finite-sample unbiased form; represents probability two randomly drawn reads belong to different taxa.',
        },
        {
          metric: "Pielou's Evenness (J')",
          formula: "J' = H' / ln(S) for S > 1",
          assumption: 'Bounded [0, 1]; 1 indicates uniform distribution across all detected species.',
        },
        {
          metric: 'Chao1 Richness Estimator',
          formula: 'S_Chao1 = S_obs + [f_1(f_1 - 1)] / [2(f_2 + 1)]',
          assumption: 'Bias-corrected estimator using singleton (f_1) and doubleton (f_2) counts; requires S >= 2 and N >= 5.',
        },
        {
          metric: 'Bray-Curtis & Jaccard Beta Diversity',
          formula: 'BC = 1 - (2 Σ min(x_ij, x_ik)) / Σ(x_ij + x_ik); Jaccard = 1 - |A ∩ B| / |A ∪ B|',
          assumption: 'Bray-Curtis incorporates abundance; Jaccard reflects presence-absence turnover across samples.',
        },
      ],
    },
  };
}
