import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Database,
  Dna,
  FileText,
  FolderKanban,
  MailCheck,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type { AppSection, Dataset, GeneratedReport, ResearchProject } from '../types/edna';

interface DashboardData {
  stats: {
    totalProjects: number;
    totalDatasets: number;
    totalAnalyzedSamples: number;
    identifiedTaxa: number;
    avgSpeciesRichness: number;
    avgShannonIndex: number;
    avgSimpsonIndex: number;
  };
  datasets: Dataset[];
  projects: ResearchProject[];
  recentJobs: Array<{
    id: string;
    analysisType: string;
    status: string;
    startedAt: string;
  }>;
  recentReports: GeneratedReport[];
  recentActivity: Array<{
    id: string;
    action: string;
    details: string | null;
    timestamp: string;
  }>;
  taxonomicDistribution: Array<{ name: string; value: number }>;
  sampleDistribution: Array<{ name: string; count: number }>;
  announcement: string;
}

const CHART_COLORS = ['#174D35', '#269B68', '#18A999', '#3D7A5E', '#5EB898', '#8FD3BA'];

export const UserDashboard: React.FC<{
  onNavigate: (section: AppSection) => void;
}> = ({ onNavigate }) => {
  const { dbUser, firebaseUser, resendVerification } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<DashboardData>('/api/dashboard')
      .then((res) => {
        if (active) {
          setData(res);
          setError(null);
        }
      })
      .catch((err: any) => {
        if (active) setError(err.message || 'Failed to load dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleResendVerification = async () => {
    try {
      await resendVerification();
      setVerifyMsg('Verification email sent. Check your inbox.');
    } catch (err: any) {
      setVerifyMsg(err.message || 'Could not send verification email.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-white rounded-xl border border-[#174D35]/10 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-[#174D35]/10 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
        {error}
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* Welcome & Verification Strip */}
      <div className="bg-white rounded-xl border border-[#174D35]/12 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-[#18A999]">
            Researcher Overview · {dbUser?.userCategory || 'Scientist'}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#174D35]">
            Welcome back, {dbUser?.fullName || 'Researcher'}
          </h1>
          <p className="mt-1 text-sm text-[#25332C]/75">
            {dbUser?.institution ? `${dbUser.institution}` : 'Institutional Workspace'}
            {dbUser?.researchField ? ` · ${dbUser.researchField}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('upload')}
            className="px-4 py-2 bg-[#174D35] hover:bg-[#269B68] text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Upload eDNA Dataset
          </button>
          <button
            type="button"
            onClick={() => onNavigate('taxonomy')}
            className="px-4 py-2 bg-[#F6FAF7] hover:bg-[#174D35]/10 text-[#174D35] border border-[#174D35]/20 text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Dna className="w-4 h-4" />
            Run Identification
          </button>
        </div>
      </div>

      {firebaseUser && !firebaseUser.emailVerified && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-amber-900">
          <div className="flex items-center gap-2.5">
            <MailCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Your email address is not yet verified. Verify it to ensure uninterrupted report
              distribution.
            </span>
          </div>
          <button
            type="button"
            onClick={handleResendVerification}
            className="px-3 py-1.5 bg-amber-900 text-white text-xs font-semibold rounded-lg hover:bg-amber-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Resend Verification Email
          </button>
        </div>
      )}

      {verifyMsg && (
        <div className="p-3 rounded-lg bg-[#269B68]/10 border border-[#269B68]/30 text-sm text-[#174D35]">
          {verifyMsg}
        </div>
      )}

      {data?.announcement && (
        <div className="p-4 rounded-xl bg-[#174D35]/5 border border-[#174D35]/15 text-sm text-[#174D35]">
          <span className="font-semibold">Platform Notice:</span> {data.announcement}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#174D35]/12 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#25332C]/65">
            <span>Uploaded Datasets</span>
            <Database className="w-4 h-4 text-[#18A999]" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#174D35]">
            {stats?.totalDatasets ?? 0}
          </div>
          <div className="mt-1 text-xs text-[#25332C]/65">
            Across {stats?.totalProjects ?? 0} research projects
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#174D35]/12 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#25332C]/65">
            <span>Analyzed Samples</span>
            <FolderKanban className="w-4 h-4 text-[#18A999]" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#174D35]">
            {stats?.totalAnalyzedSamples ?? 0}
          </div>
          <div className="mt-1 text-xs text-[#25332C]/65">Georeferenced sampling sites</div>
        </div>

        <div className="bg-white rounded-xl border border-[#174D35]/12 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#25332C]/65">
            <span>Identified Taxa</span>
            <Dna className="w-4 h-4 text-[#269B68]" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#174D35]">
            {stats?.identifiedTaxa ?? 0}
          </div>
          <div className="mt-1 text-xs text-[#25332C]/65">Distinct species assigned</div>
        </div>

        <div className="bg-white rounded-xl border border-[#174D35]/12 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#25332C]/65">
            <span>Biodiversity Summary</span>
            <Activity className="w-4 h-4 text-[#269B68]" />
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <div>
              <span className="text-2xl font-bold font-mono tabular-nums text-[#174D35]">
                {stats?.avgShannonIndex?.toFixed(2) ?? '0.00'}
              </span>
              <span className="ml-1 text-xs font-mono text-[#25332C]/60">H&apos;</span>
            </div>
            <div>
              <span className="text-2xl font-bold font-mono tabular-nums text-[#18A999]">
                {stats?.avgSimpsonIndex?.toFixed(2) ?? '0.00'}
              </span>
              <span className="ml-1 text-xs font-mono text-[#25332C]/60">1-D</span>
            </div>
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-[#25332C]/65">
            Mean Richness S = {stats?.avgSpeciesRichness ?? 0}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#174D35]/12 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#174D35]">
                Taxonomic Distribution by Phylum
              </h2>
              <p className="text-xs text-[#25332C]/65">
                Aggregated read abundance across validated taxonomic assignments
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('biodiversity')}
              className="text-xs font-semibold text-[#18A999] hover:text-[#174D35] cursor-pointer"
            >
              Open Biodiversity View
            </button>
          </div>
          {data?.taxonomicDistribution && data.taxonomicDistribution.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.taxonomicDistribution} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2EBE5" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#25332C' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#25332C' }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#269B68" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-[#174D35]/20 rounded-lg p-6">
              <p className="text-sm font-medium text-[#174D35]">No taxonomic assignments yet</p>
              <p className="mt-1 text-xs text-[#25332C]/65 max-w-sm">
                Upload an eDNA dataset and run Taxonomic Identification to visualize phylum-level
                read abundances.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('upload')}
                className="mt-4 px-3.5 py-2 bg-[#174D35] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Upload First Dataset
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white rounded-xl border border-[#174D35]/12 p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[#174D35]">Sample Matrix Distribution</h2>
            <p className="text-xs text-[#25332C]/65">Uploaded datasets grouped by sample medium</p>
          </div>
          {data?.sampleDistribution && data.sampleDistribution.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.sampleDistribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry: any) => `${entry.name} (${entry.count})`}
                  >
                    {data.sampleDistribution.map((entry, idx) => (
                      <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-[#25332C]/65 border border-dashed border-[#174D35]/20 rounded-lg">
              Upload datasets (Water, Soil, Sediment, Air) to inspect sample distribution.
            </div>
          )}
        </div>
      </div>

      {/* Recent Activities & Recent Reports */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#174D35]/12 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#174D35]">Recent Analysis Activities</h2>
            <button
              type="button"
              onClick={() => onNavigate('datasets')}
              className="text-xs font-semibold text-[#18A999] hover:text-[#174D35] cursor-pointer"
            >
              Manage Datasets
            </button>
          </div>
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            <div className="divide-y divide-[#174D35]/10">
              {data.recentActivity.slice(0, 6).map((act) => (
                <div key={act.id} className="py-2.5 flex items-start justify-between gap-4 text-sm">
                  <div>
                    <div className="font-medium text-[#25332C]">
                      {act.details || act.action.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs font-mono text-[#25332C]/55">{act.action}</div>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-[#25332C]/55 whitespace-nowrap">
                    {new Date(act.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#25332C]/65">No recorded activity yet.</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#174D35]/12 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#174D35]">Recent Reports</h2>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-[#18A999] hover:text-[#174D35] cursor-pointer"
            >
              Report Generator
            </button>
          </div>
          {data?.recentReports && data.recentReports.length > 0 ? (
            <div className="divide-y divide-[#174D35]/10">
              {data.recentReports.map((rep) => (
                <div key={rep.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-[#174D35] shrink-0" />
                    <div className="truncate">
                      <div className="font-medium text-[#25332C] truncate">{rep.reportName}</div>
                      <div className="text-xs font-mono text-[#25332C]/55">
                        {rep.reportFormat} · {rep.engineVersion}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[#25332C]/55 whitespace-nowrap">
                    {new Date(rep.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-[#25332C]/65">
              No scientific reports generated yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
