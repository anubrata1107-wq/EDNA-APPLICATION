import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Calculator, Info } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { BiodiversityAssessment, Dataset } from '../types/edna';

type RankKey = 'kingdom' | 'phylum' | 'class' | 'order' | 'family' | 'genus' | 'species';

const COLORS = ['#174D35', '#269B68', '#18A999', '#3E7A5D', '#62B696', '#8ED1B7', '#2D6A4F'];

export const BiodiversityModule: React.FC<{ initialDatasetId?: string }> = ({
  initialDatasetId,
}) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(initialDatasetId || '');
  const [assessment, setAssessment] = useState<BiodiversityAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRank, setSelectedRank] = useState<RankKey>('phylum');
  const [betaMetric, setBetaMetric] = useState<'bray' | 'jaccard'>('bray');

  useEffect(() => {
    apiFetch<{ datasets: Dataset[] }>('/api/datasets')
      .then((res) => {
        setDatasets(res.datasets);
        if (!selectedDatasetId && res.datasets.length > 0) {
          setSelectedDatasetId(res.datasets[0].id);
        }
      })
      .catch((err: any) => setError(err.message));
  }, [selectedDatasetId]);

  useEffect(() => {
    if (!selectedDatasetId) return;
    setLoading(true);
    setError(null);
    apiFetch<{ assessment: BiodiversityAssessment }>(`/api/analysis/biodiversity/${selectedDatasetId}`)
      .then((res) => setAssessment(res.assessment))
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedDatasetId]);

  const handleCompute = async () => {
    if (!selectedDatasetId) return;
    setComputing(true);
    setError(null);
    try {
      const res = await apiFetch<{ assessment: BiodiversityAssessment }>('/api/analysis/biodiversity', {
        method: 'POST',
        body: JSON.stringify({ datasetId: selectedDatasetId }),
      });
      setAssessment(res.assessment);
    } catch (err: any) {
      setError(err.message || 'Biodiversity assessment validation failed.');
    } finally {
      setComputing(false);
    }
  };

  const rankData = assessment?.compositionByRank[selectedRank] || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#174D35]">Biodiversity Assessment Workspace</h1>
          <p className="text-sm text-[#25332C]/75">
            Mathematically validated alpha diversity, beta dissimilarity matrices, PCoA ordination,
            and ecological abundance structure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-[#174D35]/20 rounded-lg"
          >
            {datasets.length === 0 && <option value="">No datasets uploaded</option>}
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.fileName}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={computing || !selectedDatasetId}
            onClick={handleCompute}
            className="px-4 py-2 bg-[#174D35] hover:bg-[#269B68] disabled:opacity-50 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Calculator className="w-4 h-4" />
            {computing ? 'Computing...' : 'Compute & Save Biodiversity'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && (
        <div className="h-48 bg-white rounded-xl border border-[#174D35]/10 animate-pulse" />
      )}

      {!loading && assessment && !assessment.valid && (
        <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
          <div className="font-semibold">Input Data Validation Notice</div>
          <p className="mt-1">{assessment.validationError}</p>
        </div>
      )}

      {!loading && assessment && assessment.valid && (
        <>
          {/* A. Alpha Diversity Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-[#174D35]/12 p-4">
              <div className="text-xs text-[#25332C]/65">Observed Richness (S)</div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#174D35]">
                {assessment.datasetAlpha.richness}
              </div>
              <div className="mt-1 text-xs font-mono text-[#25332C]/60">
                N = {assessment.datasetAlpha.totalIndividuals} reads
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#174D35]/12 p-4">
              <div className="text-xs text-[#25332C]/65">Shannon-Wiener (H&apos;)</div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#174D35]">
                {assessment.datasetAlpha.shannonIndex.toFixed(3)}
              </div>
              <div className="mt-1 text-xs text-[#25332C]/60">Natural log base</div>
            </div>
            <div className="bg-white rounded-xl border border-[#174D35]/12 p-4">
              <div className="text-xs text-[#25332C]/65">Simpson Diversity (1-D)</div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#18A999]">
                {assessment.datasetAlpha.simpsonIndex.toFixed(3)}
              </div>
              <div className="mt-1 text-xs text-[#25332C]/60">Unbiased finite form</div>
            </div>
            <div className="bg-white rounded-xl border border-[#174D35]/12 p-4">
              <div className="text-xs text-[#25332C]/65">Pielou&apos;s Evenness (J&apos;)</div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#174D35]">
                {assessment.datasetAlpha.pielouEvenness.toFixed(3)}
              </div>
              <div className="mt-1 text-xs text-[#25332C]/60">H&apos; / ln(S)</div>
            </div>
            <div className="bg-white rounded-xl border border-[#174D35]/12 p-4">
              <div className="text-xs text-[#25332C]/65">Chao1 Richness Estimator</div>
              <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-[#269B68]">
                {assessment.datasetAlpha.chao1Estimate !== null
                  ? assessment.datasetAlpha.chao1Estimate.toFixed(1)
                  : 'N/A'}
              </div>
              <div className="mt-1 text-xs text-[#25332C]/60">Bias-corrected asymptote</div>
            </div>
          </div>

          {/* Per-sample Alpha Comparison Chart & Table */}
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-white rounded-xl border border-[#174D35]/12 p-6">
              <h2 className="text-base font-semibold text-[#174D35] mb-1">
                Alpha Diversity Comparison Across Sampling Sites
              </h2>
              <p className="text-xs text-[#25332C]/65 mb-4">
                Shannon (H&apos;) and Simpson (1-D) indices per sample
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assessment.sampleAlphas}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2EBE5" />
                    <XAxis dataKey="sampleLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="shannonIndex" name="Shannon H'" fill="#174D35" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="simpsonIndex" name="Simpson 1-D" fill="#18A999" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-6 bg-white rounded-xl border border-[#174D35]/12 p-6 overflow-x-auto">
              <h2 className="text-base font-semibold text-[#174D35] mb-3">
                Sample-Level Alpha Diversity Table
              </h2>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6FAF7] border-b border-[#174D35]/12 font-semibold text-[#174D35]">
                  <tr>
                    <th className="py-2 px-2.5">Sample</th>
                    <th className="py-2 px-2.5 text-right">Richness</th>
                    <th className="py-2 px-2.5 text-right">Reads</th>
                    <th className="py-2 px-2.5 text-right">Shannon H&apos;</th>
                    <th className="py-2 px-2.5 text-right">Simpson 1-D</th>
                    <th className="py-2 px-2.5 text-right">Pielou J&apos;</th>
                    <th className="py-2 px-2.5 text-right">Chao1</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#174D35]/10 font-mono tabular-nums">
                  {assessment.sampleAlphas.map((s) => (
                    <tr key={s.sampleLabel}>
                      <td className="py-2 px-2.5 font-sans font-medium text-[#174D35]">
                        {s.sampleLabel}
                      </td>
                      <td className="py-2 px-2.5 text-right">{s.richness}</td>
                      <td className="py-2 px-2.5 text-right">{s.totalIndividuals}</td>
                      <td className="py-2 px-2.5 text-right">{s.shannonIndex.toFixed(3)}</td>
                      <td className="py-2 px-2.5 text-right">{s.simpsonIndex.toFixed(3)}</td>
                      <td className="py-2 px-2.5 text-right">{s.pielouEvenness.toFixed(3)}</td>
                      <td className="py-2 px-2.5 text-right">
                        {s.chao1Estimate !== null ? s.chao1Estimate.toFixed(1) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* B. Beta Diversity Heatmap & PCoA */}
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-white rounded-xl border border-[#174D35]/12 p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-[#174D35]">
                    Beta Diversity Pairwise Matrix
                  </h2>
                  <p className="text-xs text-[#25332C]/65">
                    0.0 = identical composition · 1.0 = completely distinct
                  </p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-[#F6FAF7] rounded-lg border border-[#174D35]/10">
                  <button
                    type="button"
                    onClick={() => setBetaMetric('bray')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                      betaMetric === 'bray' ? 'bg-[#174D35] text-white' : 'text-[#25332C]/70'
                    }`}
                  >
                    Bray-Curtis
                  </button>
                  <button
                    type="button"
                    onClick={() => setBetaMetric('jaccard')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                      betaMetric === 'jaccard' ? 'bg-[#174D35] text-white' : 'text-[#25332C]/70'
                    }`}
                  >
                    Jaccard
                  </button>
                </div>
              </div>

              {assessment.sampleNames.length < 2 ? (
                <div className="p-8 text-center text-xs text-[#25332C]/65 border border-dashed border-[#174D35]/20 rounded-lg">
                  Beta diversity comparison requires at least 2 distinct sampling sites in the dataset.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse font-mono tabular-nums">
                    <thead>
                      <tr>
                        <th className="p-2 text-left font-sans text-[#174D35]">Sample</th>
                        {assessment.sampleNames.map((col) => (
                          <th key={col} className="p-2 text-center font-sans text-[#174D35]">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assessment.sampleNames.map((row) => (
                        <tr key={row}>
                          <td className="p-2 font-sans font-semibold text-[#174D35]">{row}</td>
                          {assessment.sampleNames.map((col) => {
                            const cell = assessment.betaMatrix.find(
                              (b) => b.rowSample === row && b.colSample === col
                            );
                            const val =
                              betaMetric === 'bray'
                                ? cell?.brayCurtisDissimilarity ?? 0
                                : cell?.jaccardDissimilarity ?? 0;
                            const alpha = Math.min(0.85, Math.max(0.08, val));
                            return (
                              <td
                                key={col}
                                style={{
                                  backgroundColor:
                                    row === col
                                      ? '#F6FAF7'
                                      : `rgba(24, 169, 153, ${alpha.toFixed(2)})`,
                                  color: val > 0.55 && row !== col ? '#ffffff' : '#174D35',
                                }}
                                className="p-2 text-center border border-white rounded"
                              >
                                {val.toFixed(3)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="lg:col-span-6 bg-white rounded-xl border border-[#174D35]/12 p-6">
              <h2 className="text-base font-semibold text-[#174D35]">
                Principal Coordinate Analysis (PCoA)
              </h2>
              <p className="text-xs text-[#25332C]/65 mb-4">
                PC1 ({assessment.pcoa.varianceExplainedPct[0]}% var) vs PC2 (
                {assessment.pcoa.varianceExplainedPct[1]}% var) on Bray-Curtis distances
              </p>
              {assessment.pcoa.points.length < 2 ? (
                <div className="h-56 flex items-center justify-center text-xs text-[#25332C]/65 border border-dashed border-[#174D35]/20 rounded-lg p-4 text-center">
                  {assessment.pcoa.note}
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 16, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2EBE5" />
                      <XAxis
                        type="number"
                        dataKey="pc1"
                        name="PC1"
                        tick={{ fontSize: 11 }}
                        label={{
                          value: `PC1 (${assessment.pcoa.varianceExplainedPct[0]}%)`,
                          position: 'insideBottom',
                          offset: -8,
                          fontSize: 11,
                        }}
                      />
                      <YAxis
                        type="number"
                        dataKey="pc2"
                        name="PC2"
                        tick={{ fontSize: 11 }}
                        label={{
                          value: `PC2 (${assessment.pcoa.varianceExplainedPct[1]}%)`,
                          angle: -90,
                          position: 'insideLeft',
                          fontSize: 11,
                        }}
                      />
                      <ZAxis dataKey="richness" range={[80, 260]} name="Richness" />
                      <Tooltip
                        formatter={(val: any, name: any) => [val, String(name ?? '')]}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.sampleLabel || 'Sample'
                        }
                      />
                      <Scatter name="Samples" data={assessment.pcoa.points} fill="#174D35" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* C. Taxonomic Composition Across All 7 Ranks */}
          <div className="bg-white rounded-xl border border-[#174D35]/12 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#174D35]">
                  Taxonomic Composition & Relative Abundance
                </h2>
                <p className="text-xs text-[#25332C]/65">
                  Switch across Kingdom, Phylum, Class, Order, Family, Genus, and Species ranks
                </p>
              </div>
              <div className="flex flex-wrap gap-1 p-1 bg-[#F6FAF7] rounded-lg border border-[#174D35]/10">
                {(['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'] as RankKey[]).map(
                  (rk) => (
                    <button
                      key={rk}
                      type="button"
                      onClick={() => setSelectedRank(rk)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded capitalize cursor-pointer ${
                        selectedRank === rk
                          ? 'bg-[#174D35] text-white'
                          : 'text-[#25332C]/75 hover:text-[#174D35]'
                      }`}
                    >
                      {rk}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-6 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2EBE5" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="relativeAbundancePct" name="Relative Abundance (%)" fill="#269B68" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="lg:col-span-6 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={rankData.slice(0, 7)}
                      dataKey="abundance"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={82}
                      label={(entry: any) =>
                        `${entry.name} (${entry.relativeAbundancePct}%)`
                      }
                    >
                      {rankData.slice(0, 7).map((entry, idx) => (
                        <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Dominant & Rare Taxa */}
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-[#174D35]/10">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#174D35] mb-2">
                  Dominant Taxa (≥ 10% Relative Abundance)
                </h3>
                {assessment.rareAndDominant.dominant.length === 0 ? (
                  <p className="text-xs text-[#25332C]/65">No single taxon exceeds 10% dominance.</p>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {assessment.rareAndDominant.dominant.map((t) => (
                      <div key={t.species} className="flex justify-between font-mono">
                        <span className="font-sans italic text-[#174D35]">{t.species}</span>
                        <span className="tabular-nums">
                          {t.abundance} reads ({t.relativePct}%)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#18A999] mb-2">
                  Rare Taxa (≤ 5% Relative Abundance)
                </h3>
                {assessment.rareAndDominant.rare.length === 0 ? (
                  <p className="text-xs text-[#25332C]/65">No rare taxa detected under 5%.</p>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {assessment.rareAndDominant.rare.map((t) => (
                      <div key={t.species} className="flex justify-between font-mono">
                        <span className="font-sans italic text-[#25332C]">{t.species}</span>
                        <span className="tabular-nums">
                          {t.abundance} reads ({t.relativePct}%)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Documented Formulas & Assumptions */}
          <div className="bg-white rounded-xl border border-[#174D35]/12 p-6">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-[#18A999]" />
              <h2 className="text-base font-semibold text-[#174D35]">
                Biostatistical Methodology, Formulas & Assumptions
              </h2>
            </div>
            <p className="text-xs text-[#25332C]/70 mb-4 font-mono">
              Validated Input Records Used: {assessment.methodology.inputRecordsUsed} · Excluded
              Unassigned Sequences: {assessment.methodology.excludedUnassignedRecords}
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {assessment.methodology.formulas.map((f) => (
                <div key={f.metric} className="p-3.5 rounded-lg bg-[#F6FAF7] border border-[#174D35]/10">
                  <div className="text-xs font-semibold text-[#174D35]">{f.metric}</div>
                  <div className="mt-1 text-xs font-mono text-[#18A999]">{f.formula}</div>
                  <div className="mt-1 text-xs text-[#25332C]/75">{f.assumption}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
