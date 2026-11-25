import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  FileCode2,
  FolderPlus,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { apiFetch, downloadAuthenticatedFile } from '../lib/api';
import type { Dataset, ResearchProject } from '../types/edna';

interface DatasetManagerProps {
  mode: 'projects' | 'upload' | 'datasets';
  onDatasetUploaded?: (dataset: Dataset) => void;
  onSelectForTaxonomy?: (datasetId: string) => void;
}

const SAMPLE_TYPES = ['Water', 'Soil', 'Sediment', 'Air', 'Biofilm', 'Tissue', 'Other'];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const DatasetManager: React.FC<DatasetManagerProps> = ({
  mode,
  onDatasetUploaded,
  onSelectForTaxonomy,
}) => {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New project form
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectObj, setProjectObj] = useState('');
  const [projectRegion, setProjectRegion] = useState('');

  // Upload form
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProjectId, setUploadProjectId] = useState('');
  const [sampleType, setSampleType] = useState('Water');
  const [samplingLocation, setSamplingLocation] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [temperatureC, setTemperatureC] = useState('');
  const [pH, setPH] = useState('');
  const [salinityPpt, setSalinityPpt] = useState('');
  const [dissolvedOxygenMgL, setDissolvedOxygenMgL] = useState('');
  const [depthM, setDepthM] = useState('');
  const [uploading, setUploading] = useState(false);

  // Filter & inspect state
  const [searchTerm, setSearchTerm] = useState('');
  const [formatFilter, setFormatFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'records'>('newest');
  const [inspectDataset, setInspectDataset] = useState<Dataset | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, dsRes] = await Promise.all([
        apiFetch<{ projects: ResearchProject[] }>('/api/projects'),
        apiFetch<{ datasets: Dataset[] }>('/api/datasets'),
      ]);
      setProjects(projRes.projects);
      setDatasets(dsRes.datasets);
      if (projRes.projects.length > 0 && !uploadProjectId) {
        setUploadProjectId(projRes.projects[0].id);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load projects and datasets.');
    } finally {
      setLoading(false);
    }
  }, [uploadProjectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (projectName.trim().length < 2) {
      setError('Project name must be at least 2 characters.');
      return;
    }
    try {
      const res = await apiFetch<{ project: ResearchProject }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          projectName,
          description: projectDesc,
          researchObjective: projectObj,
          region: projectRegion,
        }),
      });
      setProjects((prev) => [res.project, ...prev]);
      setUploadProjectId(res.project.id);
      setProjectName('');
      setProjectDesc('');
      setProjectObj('');
      setProjectRegion('');
      setShowProjectForm(false);
      setSuccessMsg(`Created research project "${res.project.projectName}".`);
    } catch (err: any) {
      setError(err.message || 'Failed to create research project.');
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setDatasets((prev) => prev.filter((d) => d.projectId !== id));
      setSuccessMsg('Research project deleted.');
    } catch (err: any) {
      setError(err.message || 'Failed to delete project.');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedFile) {
      setError('Please select or drop an eDNA dataset file.');
      return;
    }
    let activeProjectId = uploadProjectId;
    if (!activeProjectId && projects.length === 0) {
      setError('Please create a research project first before uploading a dataset.');
      return;
    }
    if (!activeProjectId && projects.length > 0) {
      activeProjectId = projects[0].id;
    }
    if (!samplingLocation.trim()) {
      setError('Sampling location is required.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('projectId', activeProjectId);
    formData.append('sampleType', sampleType);
    formData.append('samplingLocation', samplingLocation.trim());
    formData.append('country', country.trim());
    formData.append('region', region.trim());
    formData.append('collectionDate', collectionDate);
    if (latitude) formData.append('latitude', latitude);
    if (longitude) formData.append('longitude', longitude);
    formData.append('description', description.trim());
    if (temperatureC) formData.append('temperatureC', temperatureC);
    if (pH) formData.append('pH', pH);
    if (salinityPpt) formData.append('salinityPpt', salinityPpt);
    if (dissolvedOxygenMgL) formData.append('dissolvedOxygenMgL', dissolvedOxygenMgL);
    if (depthM) formData.append('depthM', depthM);

    setUploading(true);
    try {
      const res = await apiFetch<{
        dataset: Dataset;
        warnings: string[];
        hasPreassignedTaxonomy: boolean;
      }>('/api/datasets/upload', {
        method: 'POST',
        body: formData,
      });
      setDatasets((prev) => [res.dataset, ...prev]);
      setSelectedFile(null);
      setDescription('');
      setSuccessMsg(
        `Uploaded ${res.dataset.fileName} (${res.dataset.recordCount} records parsed). Status: ${res.dataset.processingStatus}.`
      );
      if (onDatasetUploaded) onDatasetUploaded(res.dataset);
    } catch (err: any) {
      setError(err.message || 'Dataset upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDataset = async (id: string) => {
    try {
      await apiFetch(`/api/datasets/${id}`, { method: 'DELETE' });
      setDatasets((prev) => prev.filter((d) => d.id !== id));
      setConfirmDeleteId(null);
      setSuccessMsg('Dataset removed from storage and PostgreSQL.');
    } catch (err: any) {
      setError(err.message || 'Failed to delete dataset.');
    }
  };

  const filteredDatasets = datasets
    .filter((d) => {
      if (formatFilter !== 'All' && d.fileFormat !== formatFilter) return false;
      if (statusFilter !== 'All' && d.processingStatus !== statusFilter) return false;
      if (
        searchTerm.trim() &&
        !d.fileName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !d.samplingLocation.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.fileName.localeCompare(b.fileName);
      if (sortBy === 'records') return b.recordCount - a.recordCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-[#269B68]/10 border border-[#269B68]/30 text-sm text-[#174D35] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#269B68] shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* PROJECTS VIEW */}
      {mode === 'projects' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#174D35]">Research Projects</h1>
              <p className="text-sm text-[#25332C]/75">
                Organize field sampling campaigns, environmental DNA datasets, and comparative studies.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowProjectForm((v) => !v)}
              className="px-4 py-2 bg-[#174D35] hover:bg-[#269B68] text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              New Research Project
            </button>
          </div>

          {showProjectForm && (
            <form
              onSubmit={handleCreateProject}
              className="bg-white rounded-xl border border-[#174D35]/15 p-6 space-y-4"
            >
              <h2 className="text-base font-semibold text-[#174D35]">Create Research Project</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#25332C] mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Cascade Watershed Salmonid Monitoring 2026"
                    className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#25332C] mb-1">
                    Geographic Region
                  </label>
                  <input
                    type="text"
                    value={projectRegion}
                    onChange={(e) => setProjectRegion(e.target.value)}
                    placeholder="Pacific Northwest / Southeast Asia Estuary"
                    className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">
                  Research Objective
                </label>
                <input
                  type="text"
                  value={projectObj}
                  onChange={(e) => setProjectObj(e.target.value)}
                  placeholder="Quantify freshwater biodiversity and invasive species presence via 12S/COI eDNA"
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">
                  Project Description
                </label>
                <textarea
                  rows={2}
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#174D35] hover:bg-[#269B68] text-white text-sm font-semibold rounded-lg cursor-pointer"
                >
                  Save Project
                </button>
                <button
                  type="button"
                  onClick={() => setShowProjectForm(false)}
                  className="px-4 py-2 text-sm text-[#25332C]/75 hover:text-[#174D35] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="h-40 bg-white rounded-xl border border-[#174D35]/10 animate-pulse" />
          ) : projects.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-[#174D35]/20 p-10 text-center">
              <p className="text-base font-semibold text-[#174D35]">No research projects yet</p>
              <p className="mt-1 text-sm text-[#25332C]/70">
                Create a research project to group your environmental DNA sampling datasets.
              </p>
              <button
                type="button"
                onClick={() => setShowProjectForm(true)}
                className="mt-4 px-4 py-2 bg-[#174D35] text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Create First Project
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {projects.map((p) => {
                const count = datasets.filter((d) => d.projectId === p.id).length;
                return (
                  <div
                    key={p.id}
                    className="bg-white rounded-xl border border-[#174D35]/12 p-5 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold text-[#174D35]">{p.projectName}</h3>
                        <button
                          type="button"
                          onClick={() => handleDeleteProject(p.id)}
                          aria-label="Delete project"
                          className="p-1.5 text-[#25332C]/45 hover:text-red-600 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {p.researchObjective && (
                        <p className="mt-1.5 text-sm text-[#25332C]/80">{p.researchObjective}</p>
                      )}
                      {p.description && (
                        <p className="mt-1 text-xs text-[#25332C]/65">{p.description}</p>
                      )}
                    </div>
                    <div className="pt-3 border-t border-[#174D35]/10 flex items-center justify-between text-xs text-[#25332C]/65 font-mono tabular-nums">
                      <span>{count} dataset(s)</span>
                      <span>
                        {p.region ? `${p.region} · ` : ''}
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* UPLOAD VIEW */}
      {mode === 'upload' && (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#174D35]">Upload eDNA Dataset</h1>
              <p className="text-sm text-[#25332C]/75">
                Ingest raw sequences (FASTA, FASTQ) or structured metabarcoding tables (CSV, TSV,
                XLSX, JSON).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#25332C]/65">Reference Sample Files:</span>
              <a
                href="/api/sample-files/freshwater_river_12s_sample.fasta"
                download
                className="px-3 py-1.5 bg-white border border-[#174D35]/20 hover:border-[#174D35] rounded-lg text-[#174D35] font-medium inline-flex items-center gap-1.5"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                Sample 12S FASTA
              </a>
              <a
                href="/api/sample-files/estuary_metabarcoding_abundances.csv"
                download
                className="px-3 py-1.5 bg-white border border-[#174D35]/20 hover:border-[#174D35] rounded-lg text-[#174D35] font-medium inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Sample Estuary CSV
              </a>
            </div>
          </div>

          {projects.length === 0 && !loading && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm text-amber-900">
                Create a research project before uploading your first eDNA dataset.
              </div>
              <form onSubmit={handleCreateProject} className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Quick project name..."
                  className="px-3 py-1.5 text-sm bg-white border border-amber-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#174D35] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Create Project
                </button>
              </form>
            </div>
          )}

          <form
            onSubmit={handleUploadSubmit}
            className="bg-white rounded-xl border border-[#174D35]/12 p-6 space-y-6"
          >
            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files?.[0]) {
                  setSelectedFile(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragActive
                  ? 'border-[#18A999] bg-[#18A999]/5'
                  : 'border-[#174D35]/20 bg-[#F6FAF7]'
              }`}
            >
              <UploadCloud className="w-8 h-8 text-[#174D35] mx-auto" />
              <div className="mt-3 text-sm font-semibold text-[#174D35]">
                {selectedFile
                  ? `Selected: ${selectedFile.name} (${formatBytes(selectedFile.size)})`
                  : 'Drag and drop your eDNA dataset file here'}
              </div>
              <p className="mt-1 text-xs text-[#25332C]/65">
                Supported formats: .fasta, .fa, .fastq, .fq, .csv, .tsv, .xlsx, .json (Max 25 MB)
              </p>
              <label className="mt-4 inline-block px-4 py-2 bg-white border border-[#174D35]/20 hover:border-[#174D35] rounded-lg text-xs font-semibold text-[#174D35] cursor-pointer">
                Browse Files
                <input
                  type="file"
                  accept=".fasta,.fa,.fastq,.fq,.csv,.tsv,.xlsx,.json"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">
                  Research Project *
                </label>
                <select
                  required
                  value={uploadProjectId}
                  onChange={(e) => setUploadProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg bg-white"
                >
                  {projects.length === 0 && <option value="">No projects available</option>}
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">
                  Sample Type *
                </label>
                <select
                  value={sampleType}
                  onChange={(e) => setSampleType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg bg-white"
                >
                  {SAMPLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">
                  Collection Date *
                </label>
                <input
                  type="date"
                  required
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">
                  Sampling Location *
                </label>
                <input
                  type="text"
                  required
                  value={samplingLocation}
                  onChange={(e) => setSamplingLocation(e.target.value)}
                  placeholder="Upper Cascade River Reach"
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Singapore / United States"
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">Region</label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Johor Strait / Puget Sound"
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">
                  GPS Latitude (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="1.4481"
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">
                  GPS Longitude (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="103.7292"
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">
                  Water/Soil Temp (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={temperatureC}
                  onChange={(e) => setTemperatureC(e.target.value)}
                  placeholder="14.5"
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">pH</label>
                <input
                  type="number"
                  step="0.01"
                  value={pH}
                  onChange={(e) => setPH(e.target.value)}
                  placeholder="7.4"
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">
                  Salinity (ppt)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={salinityPpt}
                  onChange={(e) => setSalinityPpt(e.target.value)}
                  placeholder="0.2"
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#25332C] mb-1">
                  Dissolved O₂ (mg/L) / Depth (m)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={dissolvedOxygenMgL}
                    onChange={(e) => setDissolvedOxygenMgL(e.target.value)}
                    placeholder="DO mg/L"
                    className="w-full px-2.5 py-2 text-sm border border-[#174D35]/20 rounded-lg font-mono"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={depthM}
                    onChange={(e) => setDepthM(e.target.value)}
                    placeholder="Depth m"
                    className="w-full px-2.5 py-2 text-sm border border-[#174D35]/20 rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#25332C] mb-1">
                Dataset Description & Field Notes
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sterivex 0.22 µm filtration protocol, 2L sample volume..."
                className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={uploading || !selectedFile || projects.length === 0}
                className="px-6 py-2.5 bg-[#174D35] hover:bg-[#269B68] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {uploading ? 'Uploading & Parsing...' : 'Upload & Parse Dataset'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DATASET MANAGEMENT VIEW */}
      {mode === 'datasets' && (
        <div className="space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#174D35]">Dataset Management</h1>
              <p className="text-sm text-[#25332C]/75">
                Inspect metadata, download stored sequence files, and track taxonomic processing.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-[#25332C]/45 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search filename or site..."
                  className="pl-9 pr-3 py-2 text-xs bg-white border border-[#174D35]/20 rounded-lg w-52"
                />
              </div>
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-[#174D35]/20 rounded-lg"
              >
                <option value="All">All Formats</option>
                <option value="FASTA">FASTA</option>
                <option value="FASTQ">FASTQ</option>
                <option value="CSV">CSV</option>
                <option value="TSV">TSV</option>
                <option value="XLSX">XLSX</option>
                <option value="JSON">JSON</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-[#174D35]/20 rounded-lg"
              >
                <option value="All">All Statuses</option>
                <option value="parsed">Parsed</option>
                <option value="identified">Identified</option>
                <option value="analyzing">Analyzing</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'name' | 'records')}
                className="px-3 py-2 text-xs bg-white border border-[#174D35]/20 rounded-lg"
              >
                <option value="newest">Sort: Newest</option>
                <option value="name">Sort: File Name</option>
                <option value="records">Sort: Record Count</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#174D35]/12 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-[#25332C]/65">Loading datasets...</div>
            ) : filteredDatasets.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#25332C]/65">
                No datasets match your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F6FAF7] border-b border-[#174D35]/12 text-xs font-semibold text-[#174D35]">
                    <tr>
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-4">Format</th>
                      <th className="py-3 px-4 text-right">Size</th>
                      <th className="py-3 px-4 text-right">Records</th>
                      <th className="py-3 px-4">Sample / Site</th>
                      <th className="py-3 px-4">Upload Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#174D35]/10">
                    {filteredDatasets.map((ds) => (
                      <tr key={ds.id} className="hover:bg-[#F6FAF7]/70">
                        <td className="py-3 px-4 font-medium text-[#174D35]">{ds.fileName}</td>
                        <td className="py-3 px-4 font-mono text-xs">{ds.fileFormat}</td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-right">
                          {formatBytes(ds.fileSize)}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-right">
                          {ds.recordCount}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#25332C]/80">
                          {ds.sampleType} · {ds.samplingLocation}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-[#25332C]/70">
                          {new Date(ds.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium capitalize">
                          <span
                            className={
                              ds.processingStatus === 'identified'
                                ? 'text-[#269B68]'
                                : ds.processingStatus === 'failed'
                                  ? 'text-red-600'
                                  : 'text-[#18A999]'
                            }
                          >
                            {ds.processingStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {onSelectForTaxonomy && (
                              <button
                                type="button"
                                onClick={() => onSelectForTaxonomy(ds.id)}
                                className="px-2.5 py-1 text-xs font-semibold bg-[#174D35] text-white rounded hover:bg-[#269B68] cursor-pointer"
                              >
                                Identify
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setInspectDataset(ds)}
                              aria-label="Inspect metadata"
                              className="p-1.5 text-[#174D35] hover:bg-[#174D35]/10 rounded cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                downloadAuthenticatedFile(
                                  `/api/datasets/${ds.id}/download`,
                                  ds.fileName
                                )
                              }
                              aria-label="Download file"
                              className="p-1.5 text-[#174D35] hover:bg-[#174D35]/10 rounded cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(ds.id)}
                              aria-label="Delete dataset"
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inspect Metadata Modal */}
      {inspectDataset && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#174D35]/15 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#174D35]/10 pb-3">
              <h3 className="text-base font-bold text-[#174D35]">{inspectDataset.fileName}</h3>
              <button
                type="button"
                onClick={() => setInspectDataset(null)}
                className="p-1 text-[#25332C]/60 hover:text-[#174D35] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#25332C]/60 block">Format / Records</span>
                <span className="font-mono font-semibold">
                  {inspectDataset.fileFormat} · {inspectDataset.recordCount}
                </span>
              </div>
              <div>
                <span className="text-[#25332C]/60 block">Sample Type</span>
                <span className="font-semibold">{inspectDataset.sampleType}</span>
              </div>
              <div>
                <span className="text-[#25332C]/60 block">Sampling Location</span>
                <span className="font-semibold">{inspectDataset.samplingLocation}</span>
              </div>
              <div>
                <span className="text-[#25332C]/60 block">Collection Date</span>
                <span className="font-mono">{inspectDataset.collectionDate}</span>
              </div>
              <div>
                <span className="text-[#25332C]/60 block">GPS Coordinates</span>
                <span className="font-mono tabular-nums">
                  {inspectDataset.latitude !== null && inspectDataset.longitude !== null
                    ? `${inspectDataset.latitude}, ${inspectDataset.longitude}`
                    : 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-[#25332C]/60 block">Environmental Metadata</span>
                <span className="font-mono">
                  {Object.keys(inspectDataset.environmentalConditions || {}).length > 0
                    ? JSON.stringify(inspectDataset.environmentalConditions)
                    : 'None recorded'}
                </span>
              </div>
            </div>
            {inspectDataset.description && (
              <p className="text-xs text-[#25332C]/80 pt-2 border-t border-[#174D35]/10">
                {inspectDataset.description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#174D35]/15 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-[#174D35]">Confirm Dataset Deletion</h3>
            <p className="text-sm text-[#25332C]/80">
              Permanently remove this dataset, its parsed sequences, taxonomic identifications, and
              biodiversity records? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm text-[#25332C]/75 hover:text-[#174D35] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDataset(confirmDeleteId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
