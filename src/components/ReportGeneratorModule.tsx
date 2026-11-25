import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, FileText, Printer, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type {
  BiodiversityAssessment,
  Dataset,
  GeneratedReport,
  ResearchProject,
  TaxonomicResult,
} from '../types/edna';

export const ReportGeneratorModule: React.FC = () => {
  const { dbUser } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');

  const [taxResults, setTaxResults] = useState<TaxonomicResult[]>([]);
  const [bioAssessment, setBioAssessment] = useState<BiodiversityAssessment | null>(null);
  const [interpretation, setInterpretation] = useState({
    ecologicalInterpretation:
      'Biological community structure reflects the detected amplicon abundance distribution across sampled matrices.',
    limitations:
      'Taxonomic resolution depends on marker locus conservation, PCR primer bias, and curated voucher reference coverage.',
    conclusion:
      'Dataset archived with reproducible alpha/beta biodiversity estimates for longitudinal monitoring.',
  });

  const [loadingAiDraft, setLoadingAiDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const engineVersion = 'eDNA-BioStats 1.0.0';
  const analysisDate = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([
      apiFetch<{ datasets: Dataset[] }>('/api/datasets'),
      apiFetch<{ projects: ResearchProject[] }>('/api/projects'),
      apiFetch<{ reports: GeneratedReport[] }>('/api/reports'),
    ])
      .then(([dsRes, projRes, repRes]) => {
        setDatasets(dsRes.datasets);
        setProjects(projRes.projects);
        setReports(repRes.reports);
        if (dsRes.datasets.length > 0) setSelectedDatasetId(dsRes.datasets[0].id);
      })
      .catch((err: any) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedDatasetId) return;
    Promise.all([
      apiFetch<{ results: TaxonomicResult[] }>(`/api/analysis/taxonomic/${selectedDatasetId}`),
      apiFetch<{ assessment: BiodiversityAssessment }>(
        `/api/analysis/biodiversity/${selectedDatasetId}`
      ),
    ])
      .then(([taxRes, bioRes]) => {
        setTaxResults(taxRes.results);
        setBioAssessment(bioRes.assessment);
      })
      .catch(() => {
        setTaxResults([]);
        setBioAssessment(null);
      });
  }, [selectedDatasetId]);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId) || null;
  const selectedProject =
    projects.find((p) => p.id === selectedDataset?.projectId) || null;

  const handleDraftWithAi = async () => {
    if (!selectedDatasetId) return;
    setLoadingAiDraft(true);
    setError(null);
    try {
      const res = await apiFetch<{
        interpretation: {
          ecologicalInterpretation: string;
          limitations: string;
          conclusion: string;
        };
      }>('/api/ai/interpret', {
        method: 'POST',
        body: JSON.stringify({ datasetId: selectedDatasetId }),
      });
      setInterpretation(res.interpretation);
      setSuccessMsg('AI-assisted Ecological Interpretation, Limitations, and Conclusion drafted from verified dataset metrics.');
    } catch (err: any) {
      setError(err.message || 'Failed to draft AI interpretation.');
    } finally {
      setLoadingAiDraft(false);
    }
  };

  const recordReportHistory = async (reportName: string, reportFormat: 'PDF' | 'XLSX' | 'CSV') => {
    if (!selectedDatasetId) return;
    try {
      const res = await apiFetch<{ report: GeneratedReport }>('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ datasetId: selectedDatasetId, reportName, reportFormat }),
      });
      setReports((prev) => [res.report, ...prev]);
    } catch {
      // non-blocking
    }
  };

  const handleExportPdf = async () => {
    if (!selectedDataset) return;
    const doc = new jsPDF();
    doc.setFontSize(15);
    doc.setTextColor(23, 77, 53);
    doc.text('Scientific eDNA Biodiversity Assessment Report', 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Project: ${selectedProject?.projectName || 'Research Project'}`, 14, 26);
    doc.text(
      `Researcher: ${dbUser?.fullName || ''} (${dbUser?.institution || 'Institution'})`,
      14,
      31
    );
    doc.text(
      `Dataset: ${selectedDataset.fileName} | Format: ${selectedDataset.fileFormat} | Records: ${selectedDataset.recordCount}`,
      14,
      36
    );
    doc.text(
      `Sampling: ${selectedDataset.samplingLocation} (${selectedDataset.sampleType}) | Date: ${selectedDataset.collectionDate}`,
      14,
      41
    );
    doc.text(`Analysis Date: ${analysisDate} | Engine: ${engineVersion}`, 14, 46);

    if (bioAssessment?.valid) {
      autoTable(doc, {
        startY: 52,
        head: [['Metric', 'Value', 'Notes']],
        body: [
          ['Observed Richness (S)', String(bioAssessment.datasetAlpha.richness), 'Distinct assigned species'],
          ['Total Abundance (N)', String(bioAssessment.datasetAlpha.totalIndividuals), 'Validated reads'],
          ["Shannon-Wiener (H')", bioAssessment.datasetAlpha.shannonIndex.toFixed(4), 'Natural log base'],
          ['Simpson Diversity (1-D)', bioAssessment.datasetAlpha.simpsonIndex.toFixed(4), 'Unbiased finite sample'],
          ["Pielou's Evenness (J')", bioAssessment.datasetAlpha.pielouEvenness.toFixed(4), 'H\' / ln(S)'],
          [
            'Chao1 Estimator',
            bioAssessment.datasetAlpha.chao1Estimate !== null
              ? bioAssessment.datasetAlpha.chao1Estimate.toFixed(2)
              : 'N/A',
            bioAssessment.datasetAlpha.calculationNotes,
          ],
        ],
        headStyles: { fillColor: [23, 77, 53] },
        styles: { fontSize: 8 },
      });
    }

    const afterBioY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 100;

    if (taxResults.length > 0) {
      autoTable(doc, {
        startY: afterBioY,
        head: [['Sequence ID', 'Phylum', 'Species', '% ID', 'Coverage', 'Accession', 'Status']],
        body: taxResults.slice(0, 40).map((t) => [
          t.sequenceId,
          t.phylum,
          t.species,
          `${t.percentIdentity.toFixed(1)}%`,
          `${t.queryCoverage.toFixed(1)}%`,
          t.referenceAccession,
          t.identificationStatus,
        ]),
        headStyles: { fillColor: [24, 169, 153] },
        styles: { fontSize: 7 },
      });
    }

    const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 160;
    doc.setFontSize(10);
    doc.setTextColor(23, 77, 53);
    doc.text('Ecological Interpretation & Limitations', 14, Math.min(finalY, 250));
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    const wrapped = doc.splitTextToSize(
      `${interpretation.ecologicalInterpretation}\n\nLimitations: ${interpretation.limitations}\n\nConclusion: ${interpretation.conclusion}`,
      180
    );
    doc.text(wrapped, 14, Math.min(finalY + 6, 256));

    const reportFileName = `${selectedDataset.fileName.replace(/\.[^.]+$/, '')}_eDNA_Report.pdf`;
    doc.save(reportFileName);
    await recordReportHistory(reportFileName, 'PDF');
    setSuccessMsg(`Exported PDF report "${reportFileName}".`);
  };

  const handleExportExcel = async () => {
    if (!selectedDataset) return;
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      { Field: 'Project Title', Value: selectedProject?.projectName || 'Research Project' },
      { Field: 'Researcher', Value: `${dbUser?.fullName || ''} (${dbUser?.email || ''})` },
      { Field: 'Institution', Value: dbUser?.institution || '' },
      { Field: 'Dataset File', Value: selectedDataset.fileName },
      { Field: 'Sampling Location', Value: selectedDataset.samplingLocation },
      { Field: 'Collection Date', Value: selectedDataset.collectionDate },
      { Field: 'Analysis Date', Value: analysisDate },
      { Field: 'Software / Engine Version', Value: engineVersion },
      { Field: 'Ecological Interpretation', Value: interpretation.ecologicalInterpretation },
      { Field: 'Limitations', Value: interpretation.limitations },
      { Field: 'Conclusion', Value: interpretation.conclusion },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Metadata_Summary');

    if (taxResults.length > 0) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          taxResults.map((t) => ({
            Sequence_ID: t.sequenceId,
            Kingdom: t.kingdom,
            Phylum: t.phylum,
            Class: t.taxonomicClass,
            Order: t.taxonomicOrder,
            Family: t.family,
            Genus: t.genus,
            Species: t.species,
            Percent_Identity: t.percentIdentity,
            Query_Coverage: t.queryCoverage,
            E_Value: t.eValue,
            Reference_Accession: t.referenceAccession,
            Confidence_Score: t.confidenceScore,
            Abundance: t.abundanceCount,
            Status: t.identificationStatus,
          }))
        ),
        'Taxonomic_Results'
      );
    }

    if (bioAssessment?.valid) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([bioAssessment.datasetAlpha, ...bioAssessment.sampleAlphas]),
        'Biodiversity_Indices'
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(bioAssessment.compositionByRank.species),
        'Species_Composition'
      );
    }

    const reportFileName = `${selectedDataset.fileName.replace(/\.[^.]+$/, '')}_eDNA_Report.xlsx`;
    XLSX.writeFile(wb, reportFileName);
    await recordReportHistory(reportFileName, 'XLSX');
    setSuccessMsg(`Exported Excel workbook "${reportFileName}".`);
  };

  const handleExportCsv = async () => {
    if (!selectedDataset) return;
    const headers = [
      'sequence_id',
      'kingdom',
      'phylum',
      'class',
      'order',
      'family',
      'genus',
      'species',
      'percent_identity',
      'query_coverage',
      'e_value',
      'reference_accession',
      'confidence_score',
      'abundance',
      'status',
    ];
    const rows = taxResults.map((t) =>
      [
        t.sequenceId,
        t.kingdom,
        t.phylum,
        t.taxonomicClass,
        t.taxonomicOrder,
        t.family,
        t.genus,
        t.species,
        t.percentIdentity,
        t.queryCoverage,
        t.eValue,
        t.referenceAccession,
        t.confidenceScore,
        t.abundanceCount,
        t.identificationStatus,
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const reportFileName = `${selectedDataset.fileName.replace(/\.[^.]+$/, '')}_Taxonomy.csv`;
    a.href = url;
    a.download = reportFileName;
    a.click();
    URL.revokeObjectURL(url);
    await recordReportHistory(reportFileName, 'CSV');
    setSuccessMsg(`Exported CSV "${reportFileName}".`);
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#174D35]">Scientific Report Generation</h1>
          <p className="text-sm text-[#25332C]/75">
            Compile structured multi-section biodiversity reports and export to PDF, Excel, or CSV.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
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
            disabled={!selectedDataset || loadingAiDraft}
            onClick={handleDraftWithAi}
            className="px-3.5 py-2 bg-[#18A999] hover:bg-[#174D35] disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {loadingAiDraft ? 'Drafting...' : 'AI Draft Interpretation'}
          </button>
          <button
            type="button"
            disabled={!selectedDataset}
            onClick={handleExportPdf}
            className="px-3.5 py-2 bg-[#174D35] hover:bg-[#269B68] disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            type="button"
            disabled={!selectedDataset}
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-white border border-[#174D35]/25 hover:border-[#174D35] text-[#174D35] text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            type="button"
            disabled={!selectedDataset}
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-white border border-[#174D35]/25 hover:border-[#174D35] text-[#174D35] text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            disabled={!selectedDataset}
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-white border border-[#174D35]/25 hover:border-[#174D35] text-[#174D35] text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {error && (
        <div className="no-print p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="no-print p-4 rounded-xl bg-[#269B68]/10 border border-[#269B68]/30 text-sm text-[#174D35]">
          {successMsg}
        </div>
      )}

      {/* Printable Report Preview */}
      {selectedDataset ? (
        <div className="bg-white rounded-xl border border-[#174D35]/15 p-8 space-y-6">
          <div className="border-b border-[#174D35]/15 pb-5">
            <p className="text-xs font-mono uppercase tracking-wider text-[#18A999]">
              Scientific Biodiversity Assessment Report
            </p>
            <h2 className="mt-1 text-2xl font-bold text-[#174D35]">
              {selectedProject?.projectName || 'Environmental DNA Biodiversity Study'}
            </h2>
            <div className="mt-2 text-xs text-[#25332C]/75 font-mono">
              Analysis Date: {analysisDate} · Engine Version: {engineVersion}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#174D35] mb-1.5">
                Researcher Information
              </h3>
              <p className="font-medium">{dbUser?.fullName}</p>
              <p className="text-xs text-[#25332C]/75">
                {dbUser?.userCategory} · {dbUser?.institution || 'Independent'}
              </p>
              <p className="text-xs text-[#25332C]/75">{dbUser?.email}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#174D35] mb-1.5">
                Dataset Information
              </h3>
              <p className="font-mono text-xs">{selectedDataset.fileName}</p>
              <p className="text-xs text-[#25332C]/75">
                Format: {selectedDataset.fileFormat} · Records: {selectedDataset.recordCount}
              </p>
              <p className="text-xs text-[#25332C]/75">Status: {selectedDataset.processingStatus}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#174D35] mb-1.5">
                Sampling Details
              </h3>
              <p className="font-medium">{selectedDataset.samplingLocation}</p>
              <p className="text-xs text-[#25332C]/75">
                Matrix: {selectedDataset.sampleType} · Date: {selectedDataset.collectionDate}
              </p>
              {selectedDataset.latitude !== null && selectedDataset.longitude !== null && (
                <p className="text-xs font-mono text-[#25332C]/75">
                  GPS: {selectedDataset.latitude}, {selectedDataset.longitude}
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#174D35] mb-2">Methodology</h3>
            <p className="text-xs text-[#25332C]/85 leading-relaxed">
              Sequences were screened for length and base call ambiguity, aligned via deterministic
              k-mer containment and nucleotide overlap against curated marker reference vouchers (or
              validated user-supplied abundance tables). Alpha diversity was calculated via Observed
              Richness (S), Shannon-Wiener (H&apos;), unbiased Simpson (1-D), Pielou evenness
              (J&apos;), and bias-corrected Chao1; beta diversity was assessed via Bray-Curtis and
              Jaccard dissimilarities.
            </p>
          </div>

          {bioAssessment?.valid && (
            <div>
              <h3 className="text-sm font-semibold text-[#174D35] mb-2">
                Biodiversity Indices Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono tabular-nums">
                <div className="p-3 bg-[#F6FAF7] rounded-lg">
                  <span className="text-[#25332C]/60 block font-sans">Richness (S)</span>
                  <span className="text-lg font-bold text-[#174D35]">
                    {bioAssessment.datasetAlpha.richness}
                  </span>
                </div>
                <div className="p-3 bg-[#F6FAF7] rounded-lg">
                  <span className="text-[#25332C]/60 block font-sans">Shannon (H&apos;)</span>
                  <span className="text-lg font-bold text-[#174D35]">
                    {bioAssessment.datasetAlpha.shannonIndex.toFixed(3)}
                  </span>
                </div>
                <div className="p-3 bg-[#F6FAF7] rounded-lg">
                  <span className="text-[#25332C]/60 block font-sans">Simpson (1-D)</span>
                  <span className="text-lg font-bold text-[#18A999]">
                    {bioAssessment.datasetAlpha.simpsonIndex.toFixed(3)}
                  </span>
                </div>
                <div className="p-3 bg-[#F6FAF7] rounded-lg">
                  <span className="text-[#25332C]/60 block font-sans">Pielou (J&apos;)</span>
                  <span className="text-lg font-bold text-[#174D35]">
                    {bioAssessment.datasetAlpha.pielouEvenness.toFixed(3)}
                  </span>
                </div>
                <div className="p-3 bg-[#F6FAF7] rounded-lg">
                  <span className="text-[#25332C]/60 block font-sans">Chao1</span>
                  <span className="text-lg font-bold text-[#269B68]">
                    {bioAssessment.datasetAlpha.chao1Estimate !== null
                      ? bioAssessment.datasetAlpha.chao1Estimate.toFixed(1)
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {taxResults.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#174D35] mb-2">
                Taxonomic Identification Results (Top {Math.min(15, taxResults.length)} of{' '}
                {taxResults.length})
              </h3>
              <div className="overflow-x-auto border border-[#174D35]/12 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F6FAF7] border-b border-[#174D35]/12 font-semibold text-[#174D35]">
                    <tr>
                      <th className="py-2 px-3">Sequence ID</th>
                      <th className="py-2 px-3">Phylum</th>
                      <th className="py-2 px-3">Species</th>
                      <th className="py-2 px-3 text-right">% Identity</th>
                      <th className="py-2 px-3 text-right">Abundance</th>
                      <th className="py-2 px-3">Accession</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#174D35]/10">
                    {taxResults.slice(0, 15).map((t, i) => (
                      <tr key={i}>
                        <td className="py-1.5 px-3 font-mono">{t.sequenceId}</td>
                        <td className="py-1.5 px-3">{t.phylum}</td>
                        <td className="py-1.5 px-3 italic">{t.species}</td>
                        <td className="py-1.5 px-3 font-mono tabular-nums text-right">
                          {t.percentIdentity.toFixed(1)}%
                        </td>
                        <td className="py-1.5 px-3 font-mono tabular-nums text-right">
                          {t.abundanceCount}
                        </td>
                        <td className="py-1.5 px-3 font-mono">{t.referenceAccession}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4 pt-2 border-t border-[#174D35]/10 text-xs leading-relaxed">
            <div>
              <h3 className="font-semibold text-[#174D35] mb-1">Ecological Interpretation</h3>
              <p className="text-[#25332C]/85">{interpretation.ecologicalInterpretation}</p>
            </div>
            <div>
              <h3 className="font-semibold text-[#174D35] mb-1">Limitations & Assumptions</h3>
              <p className="text-[#25332C]/85">{interpretation.limitations}</p>
            </div>
            <div>
              <h3 className="font-semibold text-[#174D35] mb-1">Conclusion & References</h3>
              <p className="text-[#25332C]/85">{interpretation.conclusion}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-dashed border-[#174D35]/20 p-10 text-center text-sm text-[#25332C]/65">
          Upload and analyze a dataset first to generate downloadable scientific reports.
        </div>
      )}

      {/* Report History */}
      <div className="no-print bg-white rounded-xl border border-[#174D35]/12 p-6">
        <h3 className="text-base font-semibold text-[#174D35] mb-3">Report Generation History</h3>
        {reports.length === 0 ? (
          <p className="text-xs text-[#25332C]/65">No reports exported yet.</p>
        ) : (
          <div className="divide-y divide-[#174D35]/10 text-xs">
            {reports.map((rep) => (
              <div key={rep.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-medium text-[#174D35]">{rep.reportName}</span>
                  <span className="ml-2 font-mono text-[#25332C]/60">
                    {rep.reportFormat} · {rep.engineVersion}
                  </span>
                </div>
                <span className="font-mono tabular-nums text-[#25332C]/60">
                  {new Date(rep.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
