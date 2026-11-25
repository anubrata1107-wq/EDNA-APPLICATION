import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Dna, Play, Search } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Dataset, TaxonomicResult } from '../types/edna';

const MARKERS = ['12S rRNA', '16S rRNA', '18S rRNA', 'COI', 'ITS', 'rbcL', 'matK', 'All Markers'];
const REFERENCE_DBS = ['NCBI GenBank', 'SILVA', 'BOLD Systems', 'UNITE', 'MIDORI', 'All Databases'];

export const TaxonomicModule: React.FC<{
  initialDatasetId?: string;
  onGoToBiodiversity: (datasetId: string) => void;
}> = ({ initialDatasetId, onGoToBiodiversity }) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(initialDatasetId || '');
  const [markerGene, setMarkerGene] = useState('12S rRNA');
  const [referenceDatabase, setReferenceDatabase] = useState('NCBI GenBank');
  const [minIdentity, setMinIdentity] = useState(85);
  const [minCoverage, setMinCoverage] = useState(60);
  const [customReferenceFasta, setCustomReferenceFasta] = useState('');

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TaxonomicResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [summaryInfo, setSummaryInfo] = useState<string | null>(null);

  const pageSize = 15;

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
    apiFetch<{ results: TaxonomicResult[] }>(`/api/analysis/taxonomic/${selectedDatasetId}`)
      .then((res) => {
        setResults(res.results);
        setPage(1);
      })
      .catch(() => {
        setResults([]);
      });
  }, [selectedDatasetId]);

  const handleRunIdentification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDatasetId) {
      setError('Select an uploaded dataset first.');
      return;
    }
    setError(null);
    setSummaryInfo(null);
    setRunning(true);
    try {
      const res = await apiFetch<{
        results: TaxonomicResult[];
        summary: {
          total: number;
          matched: number;
          lowConfidence: number;
          unassigned: number;
          engineMode: string;
        };
      }>('/api/analysis/taxonomic', {
        method: 'POST',
        body: JSON.stringify({
          datasetId: selectedDatasetId,
          markerGene,
          referenceDatabase,
          minIdentity,
          minCoverage,
          customReferenceFasta,
        }),
      });
      setResults(res.results);
      setPage(1);
      setSummaryInfo(
        `Processed ${res.summary.total} sequences (${res.summary.matched} matched, ${res.summary.lowConfidence} low-confidence, ${res.summary.unassigned} unassigned) via ${res.summary.engineMode === 'user_reference_fasta' ? 'User-Provided Reference FASTA' : 'Local Curated Voucher Alignment Engine'}.`
      );
    } catch (err: any) {
      setError(err.message || 'Taxonomic identification failed.');
    } finally {
      setRunning(false);
    }
  };

  const filteredResults = results.filter((r) => {
    if (statusFilter !== 'All' && r.identificationStatus !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.sequenceId.toLowerCase().includes(q) ||
        r.species.toLowerCase().includes(q) ||
        r.genus.toLowerCase().includes(q) ||
        r.phylum.toLowerCase().includes(q) ||
        r.referenceAccession.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const pagedResults = filteredResults.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#174D35]">Taxonomic Identification Workspace</h1>
          <p className="text-sm text-[#25332C]/75">
            Align eDNA marker sequences deterministically against curated biological voucher sets or
            user-supplied reference FASTA files.
          </p>
        </div>
        {selectedDatasetId && results.length > 0 && (
          <button
            type="button"
            onClick={() => onGoToBiodiversity(selectedDatasetId)}
            className="px-4 py-2 bg-[#18A999] hover:bg-[#174D35] text-white text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            Assess Biodiversity Metrics
          </button>
        )}
      </div>

      {/* Engine Honesty Notice */}
      <div className="p-4 rounded-xl bg-white border border-[#174D35]/15 text-xs text-[#25332C]/85 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-[#18A999] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#174D35]">
            Identification Engine Status (Local Curated Voucher Alignment):
          </span>{' '}
          External remote BLAST+/SILVA daemon is not connected in this runtime. Identifications are
          computed strictly by deterministic 7-mer containment and optimal nucleotide alignment
          against verified built-in marker vouchers or your uploaded reference FASTA—never generated
          by Gemini AI. Sequences without a verified match remain marked <code>unassigned</code>.
        </div>
      </div>

      {/* Step 1-5 Configuration Workflow */}
      <form
        onSubmit={handleRunIdentification}
        className="bg-white rounded-xl border border-[#174D35]/12 p-6 space-y-5"
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#174D35] mb-1">
              1. Select Dataset
            </label>
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg bg-white"
            >
              {datasets.length === 0 && <option value="">No datasets uploaded</option>}
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.fileName} ({ds.recordCount})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#174D35] mb-1">
              2. Marker / Gene Region
            </label>
            <select
              value={markerGene}
              onChange={(e) => setMarkerGene(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg bg-white"
            >
              {MARKERS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#174D35] mb-1">
              3. Reference Database
            </label>
            <select
              value={referenceDatabase}
              onChange={(e) => setReferenceDatabase(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg bg-white"
            >
              {REFERENCE_DBS.map((dbName) => (
                <option key={dbName} value={dbName}>
                  {dbName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#174D35] mb-1">
              4a. Min % Identity
            </label>
            <input
              type="number"
              min={50}
              max={100}
              value={minIdentity}
              onChange={(e) => setMinIdentity(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#174D35] mb-1">
              4b. Min Query Coverage %
            </label>
            <input
              type="number"
              min={20}
              max={100}
              value={minCoverage}
              onChange={(e) => setMinCoverage(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#174D35] mb-1">
            Optional User-Provided Reference FASTA (Format:{' '}
            <code className="font-mono">&gt;ACCESSION Kingdom;Phylum;Class;Order;Family;Genus;Species</code>)
          </label>
          <textarea
            rows={2}
            value={customReferenceFasta}
            onChange={(e) => setCustomReferenceFasta(e.target.value)}
            placeholder="Leave empty to use built-in curated voucher reference sequences..."
            className="w-full px-3 py-2 text-xs font-mono border border-[#174D35]/20 rounded-lg"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-[#25332C]/65">
            Step 5: Submit sequence alignment job to compute taxonomic ranks and E-values.
          </div>
          <button
            type="submit"
            disabled={running || !selectedDatasetId}
            className="px-5 py-2.5 bg-[#174D35] hover:bg-[#269B68] disabled:opacity-50 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            {running ? 'Running Alignment...' : 'Run Taxonomic Identification'}
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {summaryInfo && (
        <div className="p-4 rounded-xl bg-[#269B68]/10 border border-[#269B68]/30 text-sm text-[#174D35] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#269B68] shrink-0" />
          <span>{summaryInfo}</span>
        </div>
      )}

      {/* Step 6: Results Table */}
      <div className="bg-white rounded-xl border border-[#174D35]/12 overflow-hidden">
        <div className="p-4 border-b border-[#174D35]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Dna className="w-4 h-4 text-[#174D35]" />
            <h2 className="text-base font-semibold text-[#174D35]">
              Taxonomic Identification Results ({filteredResults.length})
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#25332C]/45 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter species, phylum, ID..."
                className="pl-8 pr-3 py-1.5 text-xs border border-[#174D35]/20 rounded-lg"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs border border-[#174D35]/20 rounded-lg bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="matched">Matched</option>
              <option value="imported_table">Imported Table</option>
              <option value="low_confidence">Low Confidence</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
        </div>

        {pagedResults.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#25332C]/65">
            {results.length === 0
              ? 'No taxonomic identification results yet for this dataset. Configure parameters above and click Run Taxonomic Identification.'
              : 'No results match the current filter.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6FAF7] border-b border-[#174D35]/12 font-semibold text-[#174D35]">
                  <tr>
                    <th className="py-2.5 px-3">Sequence ID</th>
                    <th className="py-2.5 px-3">Kingdom</th>
                    <th className="py-2.5 px-3">Phylum</th>
                    <th className="py-2.5 px-3">Class</th>
                    <th className="py-2.5 px-3">Order</th>
                    <th className="py-2.5 px-3">Family</th>
                    <th className="py-2.5 px-3">Genus</th>
                    <th className="py-2.5 px-3">Species</th>
                    <th className="py-2.5 px-3 text-right">% Identity</th>
                    <th className="py-2.5 px-3 text-right">Coverage</th>
                    <th className="py-2.5 px-3 text-right">E-value</th>
                    <th className="py-2.5 px-3">Accession</th>
                    <th className="py-2.5 px-3 text-right">Confidence</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#174D35]/10">
                  {pagedResults.map((row, idx) => (
                    <tr key={`${row.sequenceId}-${idx}`} className="hover:bg-[#F6FAF7]/70">
                      <td className="py-2.5 px-3 font-mono font-medium text-[#174D35]">
                        {row.sequenceId}
                      </td>
                      <td className="py-2.5 px-3">{row.kingdom}</td>
                      <td className="py-2.5 px-3">{row.phylum}</td>
                      <td className="py-2.5 px-3">{row.taxonomicClass}</td>
                      <td className="py-2.5 px-3">{row.taxonomicOrder}</td>
                      <td className="py-2.5 px-3">{row.family}</td>
                      <td className="py-2.5 px-3 italic">{row.genus}</td>
                      <td className="py-2.5 px-3 italic font-medium text-[#174D35]">
                        {row.species}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right">
                        {row.percentIdentity.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right">
                        {row.queryCoverage.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right">
                        {row.eValue}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{row.referenceAccession}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right">
                        {row.confidenceScore.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        <span
                          className={
                            row.identificationStatus === 'matched' ||
                            row.identificationStatus === 'imported_table'
                              ? 'text-[#269B68]'
                              : row.identificationStatus === 'low_confidence'
                                ? 'text-amber-700'
                                : 'text-[#25332C]/55'
                          }
                        >
                          {row.identificationStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-[#174D35]/10 flex items-center justify-between text-xs text-[#25332C]/75">
                <span className="font-mono tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-2.5 py-1 border border-[#174D35]/20 rounded disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2.5 py-1 border border-[#174D35]/20 rounded disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
