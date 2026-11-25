import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Database,
  LayoutDashboard,
  Lock,
  LogOut,
  Search,
  Settings,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type { DbUser, ReferenceDatabase } from '../types/edna';

type AdminTab =
  | 'overview'
  | 'users'
  | 'datasets'
  | 'monitoring'
  | 'settings'
  | 'security';

interface AdminStatusResponse {
  hasConfiguredPasscode: boolean;
  adminCount: number;
  isCurrentUserAdmin: boolean;
  userEmail: string | null;
}

export const AdminControlPanel: React.FC = () => {
  const { firebaseUser, adminToken, setAdminToken, loginWithGoogle, logout } = useAuth();
  const [status, setStatus] = useState<AdminStatusResponse | null>(null);
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<{
    totalUsers: number;
    activeUsers: number;
    totalDatasets: number;
    totalProjects: number;
    totalAnalyses: number;
    storageBytes: number;
  } | null>(null);
  const [adminUsers, setAdminUsers] = useState<DbUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userCatFilter, setUserCatFilter] = useState('All');
  const [adminDatasets, setAdminDatasets] = useState<
    Array<{
      id: string;
      fileName: string;
      fileFormat: string;
      fileSize: number;
      recordCount: number;
      sampleType: string;
      processingStatus: string;
      createdAt: string;
      ownerEmail: string | null;
      ownerName: string | null;
    }>
  >([]);
  const [monitoring, setMonitoring] = useState<{
    jobs: Array<{
      id: string;
      analysisType: string;
      status: string;
      startedAt: string;
      errorMessage: string | null;
    }>;
    activities: Array<{
      id: string;
      action: string;
      details: string | null;
      timestamp: string;
      userEmail: string | null;
    }>;
    aiQueriesCount: number;
  } | null>(null);
  const [settingsList, setSettingsList] = useState<
    Array<{ id: string; settingName: string; settingValue: string; description: string }>
  >([]);
  const [refDbs, setRefDbs] = useState<ReferenceDatabase[]>([]);
  const [auditLogs, setAuditLogs] = useState<
    Array<{
      id: string;
      adminEmail: string;
      action: string;
      targetType: string;
      details: string | null;
      ipAddress: string | null;
      createdAt: string;
    }>
  >([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const checkAdminStatus = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const res = await apiFetch<AdminStatusResponse>('/api/admin/status');
      setStatus(res);
    } catch (err: any) {
      setAuthError(err.message);
    }
  }, [firebaseUser]);

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  const loadAdminTab = useCallback(async () => {
    if (!adminToken) return;
    try {
      if (activeTab === 'overview') {
        const res = await apiFetch<{ metrics: NonNullable<typeof overview> }>(
          '/api/admin/overview',
          {},
          adminToken
        );
        setOverview(res.metrics);
      } else if (activeTab === 'users') {
        const q = new URLSearchParams();
        if (userSearch) q.set('search', userSearch);
        if (userCatFilter !== 'All') q.set('category', userCatFilter);
        const res = await apiFetch<{ users: DbUser[] }>(
          `/api/admin/users?${q.toString()}`,
          {},
          adminToken
        );
        setAdminUsers(res.users);
      } else if (activeTab === 'datasets') {
        const res = await apiFetch<{ datasets: typeof adminDatasets }>(
          '/api/admin/datasets',
          {},
          adminToken
        );
        setAdminDatasets(res.datasets);
      } else if (activeTab === 'monitoring') {
        const res = await apiFetch<NonNullable<typeof monitoring>>(
          '/api/admin/monitoring',
          {},
          adminToken
        );
        setMonitoring(res);
      } else if (activeTab === 'settings') {
        const res = await apiFetch<{
          settings: typeof settingsList;
          referenceDatabases: ReferenceDatabase[];
        }>('/api/admin/settings', {}, adminToken);
        setSettingsList(res.settings);
        setRefDbs(res.referenceDatabases);
      } else if (activeTab === 'security') {
        const res = await apiFetch<{ logs: typeof auditLogs }>(
          '/api/admin/audit-logs',
          {},
          adminToken
        );
        setAuditLogs(res.logs);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Administrator query failed.');
    }
  }, [adminToken, activeTab, userSearch, userCatFilter]);

  useEffect(() => {
    loadAdminTab();
  }, [loadAdminTab]);

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (passcode.length < 10) {
      setAuthError('Control passcode must be at least 10 characters.');
      return;
    }
    if (passcode !== confirmPasscode) {
      setAuthError('Passcodes do not match.');
      return;
    }
    setAuthBusy(true);
    try {
      const res = await apiFetch<{ adminToken: string }>('/api/admin/bootstrap', {
        method: 'POST',
        body: JSON.stringify({ passcode }),
      });
      setAdminToken(res.adminToken);
      setPasscode('');
      setConfirmPasscode('');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleVerifyAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      const res = await apiFetch<{ adminToken: string }>('/api/admin/verify', {
        method: 'POST',
        body: JSON.stringify({ passcode }),
      });
      setAdminToken(res.adminToken);
      setPasscode('');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUpdateUser = async (
    id: string,
    patch: { accountStatus?: 'active' | 'suspended' | 'deactivated'; role?: 'user' | 'admin' }
  ) => {
    try {
      await apiFetch(
        `/api/admin/users/${id}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
        adminToken
      );
      setActionNotice('User record updated and logged to security audit trail.');
      await loadAdminTab();
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' }, adminToken);
      setActionNotice('User account removed.');
      await loadAdminTab();
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleDeleteAdminDataset = async (id: string) => {
    try {
      await apiFetch(`/api/admin/datasets/${id}`, { method: 'DELETE' }, adminToken);
      setActionNotice('Dataset deleted by administrator.');
      await loadAdminTab();
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleUpdateSetting = async (settingName: string, settingValue: string) => {
    try {
      await apiFetch(
        '/api/admin/settings',
        { method: 'PATCH', body: JSON.stringify({ settingName, settingValue }) },
        adminToken
      );
      setActionNotice(`Updated setting "${settingName}".`);
      await loadAdminTab();
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleToggleRefDb = async (id: string, isActive: boolean) => {
    try {
      await apiFetch(
        `/api/admin/reference-databases/${id}`,
        { method: 'PATCH', body: JSON.stringify({ isActive }) },
        adminToken
      );
      setActionNotice('Reference database configuration updated.');
      await loadAdminTab();
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  // Unauthenticated / Unverified Gate
  if (!adminToken) {
    return (
      <div className="min-h-screen bg-[#14251D] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#1B3127] border border-white/15 rounded-xl p-8 space-y-5">
          <div className="flex items-center gap-2.5 text-[#18A999]">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-mono uppercase tracking-wider">
              Restricted Control Plane
            </span>
          </div>
          <h1 className="text-xl font-bold text-white">Administrator Control Verification</h1>

          {authError && (
            <div className="p-3 rounded-lg bg-red-950/70 border border-red-400/40 text-xs text-red-200">
              {authError}
            </div>
          )}

          {!firebaseUser ? (
            <div className="space-y-4">
              <p className="text-sm text-white/75">
                Authenticate your authorized Google account before verifying administrator control
                credentials.
              </p>
              <button
                type="button"
                onClick={() => loginWithGoogle()}
                className="w-full py-2.5 px-4 bg-[#269B68] hover:bg-[#18A999] text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Authenticate with Google
              </button>
            </div>
          ) : status && !status.hasConfiguredPasscode && status.adminCount === 0 ? (
            <form onSubmit={handleBootstrap} className="space-y-4">
              <p className="text-xs text-white/80 leading-relaxed">
                Signed in as <span className="font-mono text-white">{firebaseUser.email}</span>.
                No administrator control passcode is configured yet. Establish the initial
                server-hashed passcode (min 10 characters) to claim administration.
              </p>
              <input
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Establish control passcode (10+ chars)"
                className="w-full px-3 py-2.5 text-sm bg-[#14251D] border border-white/20 rounded-lg text-white"
              />
              <input
                type="password"
                required
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                placeholder="Confirm control passcode"
                className="w-full px-3 py-2.5 text-sm bg-[#14251D] border border-white/20 rounded-lg text-white"
              />
              <button
                type="submit"
                disabled={authBusy}
                className="w-full py-2.5 bg-[#269B68] hover:bg-[#18A999] text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                {authBusy ? 'Claiming Control Panel...' : 'Claim Administrator Control'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyAdmin} className="space-y-4">
              <p className="text-xs text-white/80">
                Identity verified: <span className="font-mono text-white">{firebaseUser.email}</span>.
                Enter the server-side administrator passcode.
              </p>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/45 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Administrator passcode"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#14251D] border border-white/20 rounded-lg text-white"
                />
              </div>
              <button
                type="submit"
                disabled={authBusy}
                className="w-full py-2.5 bg-[#269B68] hover:bg-[#18A999] text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                {authBusy ? 'Verifying...' : 'Unlock Control Panel'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6FAF7] flex flex-col lg:flex-row">
      {/* Separate Administrator Sidebar */}
      <aside className="w-full lg:w-64 bg-[#14251D] text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-white/10">
          <div className="text-xs font-mono uppercase tracking-wider text-[#18A999]">
            Secure Control Panel
          </div>
          <div className="mt-1 text-base font-bold">Platform Administration</div>
        </div>
        <nav className="p-3 space-y-1 flex-1 text-sm">
          {[
            { id: 'overview', label: 'Admin Overview', icon: LayoutDashboard },
            { id: 'users', label: 'User Management', icon: Users },
            { id: 'datasets', label: 'Dataset Management', icon: Database },
            { id: 'monitoring', label: 'Analysis & Research Monitoring', icon: Activity },
            { id: 'settings', label: 'System Settings', icon: Settings },
            { id: 'security', label: 'Security Logs', icon: Shield },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as AdminTab)}
                className={`w-full px-3 py-2.5 rounded-lg flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-[#269B68] text-white font-semibold'
                    : 'text-white/75 hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => logout()}
            className="w-full px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10 flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Admin Content */}
      <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-x-hidden">
        {authError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
            {authError}
          </div>
        )}
        {actionNotice && (
          <div className="p-3.5 rounded-xl bg-[#269B68]/10 border border-[#269B68]/30 text-sm text-[#174D35]">
            {actionNotice}
          </div>
        )}

        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-[#174D35]">Administrator Overview</h1>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Total Registered Users', val: overview.totalUsers },
                { label: 'Active Accounts', val: overview.activeUsers },
                { label: 'Total Research Projects', val: overview.totalProjects },
                { label: 'Total Uploaded Datasets', val: overview.totalDatasets },
                { label: 'Total Analyses Run', val: overview.totalAnalyses },
                {
                  label: 'Storage Utilization',
                  val: `${(overview.storageBytes / (1024 * 1024)).toFixed(2)} MB`,
                },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl border border-[#174D35]/12 p-5">
                  <div className="text-xs text-[#25332C]/65">{kpi.label}</div>
                  <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#174D35]">
                    {kpi.val}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h1 className="text-2xl font-bold text-[#174D35]">User Management</h1>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#25332C]/45 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search name, email..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#174D35]/20 rounded-lg"
                  />
                </div>
                <select
                  value={userCatFilter}
                  onChange={(e) => setUserCatFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-[#174D35]/20 rounded-lg"
                >
                  <option value="All">All Categories</option>
                  <option value="Student">Student</option>
                  <option value="Research Scholar">Research Scholar</option>
                  <option value="Professor">Professor</option>
                  <option value="Scientist">Scientist</option>
                  <option value="Laboratory Researcher">Laboratory Researcher</option>
                  <option value="Environmental Consultant">Environmental Consultant</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#174D35]/12 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6FAF7] border-b border-[#174D35]/12 font-semibold text-[#174D35]">
                  <tr>
                    <th className="py-2.5 px-3">Researcher</th>
                    <th className="py-2.5 px-3">Category / Institution</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#174D35]/10">
                  {adminUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#174D35]">{u.fullName}</div>
                        <div className="font-mono text-[#25332C]/65">{u.email}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div>{u.userCategory}</div>
                        <div className="text-[#25332C]/65">{u.institution || '—'}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono">{u.role}</td>
                      <td className="py-2.5 px-3 font-medium capitalize">{u.accountStatus}</td>
                      <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateUser(u.id, {
                              accountStatus: u.accountStatus === 'active' ? 'suspended' : 'active',
                            })
                          }
                          className="px-2 py-1 border border-[#174D35]/20 rounded hover:bg-[#174D35] hover:text-white cursor-pointer"
                        >
                          {u.accountStatus === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateUser(u.id, {
                              role: u.role === 'admin' ? 'user' : 'admin',
                            })
                          }
                          className="px-2 py-1 border border-[#174D35]/20 rounded hover:bg-[#18A999] hover:text-white cursor-pointer"
                        >
                          {u.role === 'admin' ? 'Set User' : 'Grant Admin'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id)}
                          aria-label="Delete user"
                          className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'datasets' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-[#174D35]">Global Dataset Management</h1>
            <div className="bg-white rounded-xl border border-[#174D35]/12 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6FAF7] border-b border-[#174D35]/12 font-semibold text-[#174D35]">
                  <tr>
                    <th className="py-2.5 px-3">Dataset</th>
                    <th className="py-2.5 px-3">Owner</th>
                    <th className="py-2.5 px-3">Format / Records</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#174D35]/10">
                  {adminDatasets.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2.5 px-3 font-medium text-[#174D35]">{d.fileName}</td>
                      <td className="py-2.5 px-3 font-mono">{d.ownerEmail}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        {d.fileFormat} · {d.recordCount}
                      </td>
                      <td className="py-2.5 px-3 capitalize">{d.processingStatus}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteAdminDataset(d.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && monitoring && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-[#174D35]">Analysis & Research Monitoring</h1>
              <div className="px-4 py-2 bg-white rounded-lg border border-[#174D35]/12 text-xs font-mono">
                AI Research Assistant Calls: {monitoring.aiQueriesCount}
              </div>
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-[#174D35]/12 p-5">
                <h2 className="text-sm font-semibold text-[#174D35] mb-3">Recent Analysis Jobs</h2>
                <div className="divide-y divide-[#174D35]/10 text-xs">
                  {monitoring.jobs.map((j) => (
                    <div key={j.id} className="py-2 flex justify-between">
                      <span className="font-mono">{j.analysisType}</span>
                      <span
                        className={
                          j.status === 'failed' ? 'text-red-600 font-semibold' : 'text-[#269B68]'
                        }
                      >
                        {j.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#174D35]/12 p-5">
                <h2 className="text-sm font-semibold text-[#174D35] mb-3">Platform Activity Stream</h2>
                <div className="divide-y divide-[#174D35]/10 text-xs">
                  {monitoring.activities.slice(0, 20).map((a) => (
                    <div key={a.id} className="py-2">
                      <div className="font-medium">{a.details || a.action}</div>
                      <div className="font-mono text-[#25332C]/60">
                        {a.userEmail} · {new Date(a.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-[#174D35]">
              Platform & Reference Database Configuration
            </h1>
            <div className="bg-white rounded-xl border border-[#174D35]/12 p-6 space-y-4">
              <h2 className="text-base font-semibold text-[#174D35]">Application Settings</h2>
              {settingsList.map((s) => (
                <SettingRow key={s.id} setting={s} onSave={handleUpdateSetting} />
              ))}
            </div>

            <div className="bg-white rounded-xl border border-[#174D35]/12 p-6 space-y-3">
              <h2 className="text-base font-semibold text-[#174D35]">Reference Databases</h2>
              <div className="divide-y divide-[#174D35]/10 text-xs">
                {refDbs.map((dbItem) => (
                  <div key={dbItem.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-[#174D35]">
                        {dbItem.name} · <span className="font-mono">{dbItem.version}</span>
                      </div>
                      <div className="text-[#25332C]/70">{dbItem.description}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleRefDb(dbItem.id, !dbItem.isActive)}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        dbItem.isActive
                          ? 'bg-[#269B68] text-white'
                          : 'bg-[#F6FAF7] border border-[#174D35]/20 text-[#174D35]'
                      }`}
                    >
                      {dbItem.isActive ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-[#174D35]">Security & Audit Logs</h1>
            <div className="bg-white rounded-xl border border-[#174D35]/12 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6FAF7] border-b border-[#174D35]/12 font-semibold text-[#174D35]">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Administrator</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#174D35]/10">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{log.adminEmail}</td>
                      <td className="py-2.5 px-3 font-mono text-[#174D35]">{log.action}</td>
                      <td className="py-2.5 px-3">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const SettingRow: React.FC<{
  setting: { settingName: string; settingValue: string; description: string };
  onSave: (name: string, value: string) => void;
}> = ({ setting, onSave }) => {
  const [val, setVal] = useState(setting.settingValue);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-[#174D35]/10 last:border-none">
      <div className="flex-1">
        <div className="text-xs font-mono font-semibold text-[#174D35]">{setting.settingName}</div>
        <div className="text-xs text-[#25332C]/65">{setting.description}</div>
      </div>
      <div className="flex items-center gap-2 sm:w-96">
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="flex-1 px-3 py-1.5 text-xs border border-[#174D35]/20 rounded-lg"
        />
        <button
          type="button"
          onClick={() => onSave(setting.settingName, val)}
          className="px-3 py-1.5 bg-[#174D35] text-white text-xs font-semibold rounded-lg cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );
};
