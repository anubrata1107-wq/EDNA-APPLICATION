import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, ShieldAlert, Trash2, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type { DbUser, NotificationItem } from '../types/edna';

export const NotificationsCenter: React.FC<{ onUnreadChanged?: (count: number) => void }> = ({
  onUnreadChanged,
}) => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filterCat, setFilterCat] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
      setItems(res.notifications);
      if (onUnreadChanged) {
        onUnreadChanged(res.notifications.filter((n) => n.status === 'unread').length);
      }
    } finally {
      setLoading(false);
    }
  }, [onUnreadChanged]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markRead = async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setItems((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, status: 'read' as const } : n));
      if (onUnreadChanged) onUnreadChanged(next.filter((n) => n.status === 'unread').length);
      return next;
    });
  };

  const markAllRead = async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    setItems((prev) => {
      const next = prev.map((n) => ({ ...n, status: 'read' as const }));
      if (onUnreadChanged) onUnreadChanged(0);
      return next;
    });
  };

  const visible = items.filter((n) => filterCat === 'all' || n.category === filterCat);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#174D35]">Notifications Center</h1>
          <p className="text-sm text-[#25332C]/75">
            Track registration confirmations, dataset uploads, taxonomic jobs, reports, and
            announcements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-[#174D35]/20 rounded-lg"
          >
            <option value="all">All Categories</option>
            <option value="registration">Registration</option>
            <option value="upload">Dataset Upload</option>
            <option value="analysis">Analysis Jobs</option>
            <option value="report">Reports</option>
            <option value="announcement">Announcements</option>
          </select>
          <button
            type="button"
            onClick={markAllRead}
            className="px-3.5 py-2 bg-white border border-[#174D35]/20 hover:border-[#174D35] text-xs font-semibold text-[#174D35] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            Mark All Read
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#174D35]/12 divide-y divide-[#174D35]/10">
        {loading ? (
          <div className="p-8 text-center text-sm text-[#25332C]/65">Loading notifications...</div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#25332C]/65">
            <Bell className="w-6 h-6 mx-auto mb-2 text-[#174D35]/40" />
            No notifications in this category.
          </div>
        ) : (
          visible.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                n.status === 'unread' ? 'bg-[#269B68]/5' : ''
              }`}
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#18A999]">
                  <span className="uppercase">{n.category}</span>
                  <span>·</span>
                  <span className="tabular-nums">{new Date(n.createdAt).toLocaleString()}</span>
                  {n.status === 'unread' && (
                    <span className="font-sans font-semibold text-[#174D35]">· Unread</span>
                  )}
                </div>
                <h3 className="mt-1 text-sm font-semibold text-[#174D35]">{n.title}</h3>
                <p className="mt-0.5 text-sm text-[#25332C]/80">{n.message}</p>
              </div>
              {n.status === 'unread' && n.userId && (
                <button
                  type="button"
                  onClick={() => markRead(n.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#174D35] border border-[#174D35]/20 hover:bg-[#174D35] hover:text-white rounded-lg shrink-0 cursor-pointer"
                >
                  Mark Read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const ProfileAndSettingsView: React.FC<{ mode: 'profile' | 'settings' }> = ({ mode }) => {
  const { dbUser, firebaseUser, changePassword, refreshProfile, logout } = useAuth();
  const [activities, setActivities] = useState<
    Array<{ id: string; action: string; details: string | null; timestamp: string }>
  >([]);

  const [fullName, setFullName] = useState(dbUser?.fullName || '');
  const [institution, setInstitution] = useState(dbUser?.institution || '');
  const [department, setDepartment] = useState(dbUser?.department || '');
  const [researchField, setResearchField] = useState(dbUser?.researchField || '');
  const [country, setCountry] = useState(dbUser?.country || '');
  const [userCategory, setUserCategory] = useState(dbUser?.userCategory || 'Scientist');
  const [avatarUrl, setAvatarUrl] = useState(dbUser?.avatarUrl || '');

  // Preferences & Password
  const [emailNotifications, setEmailNotifications] = useState(
    dbUser?.preferences?.emailNotifications ?? true
  );
  const [defaultMarker, setDefaultMarker] = useState(
    dbUser?.preferences?.defaultMarker || '16S rRNA'
  );
  const [defaultDatabase, setDefaultDatabase] = useState(
    dbUser?.preferences?.defaultDatabase || 'SILVA'
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{
      user: DbUser;
      activities: Array<{ id: string; action: string; details: string | null; timestamp: string }>;
    }>('/api/profile')
      .then((res) => {
        setActivities(res.activities);
        setFullName(res.user.fullName);
        setInstitution(res.user.institution);
        setDepartment(res.user.department);
        setResearchField(res.user.researchField);
        setCountry(res.user.country);
        setUserCategory(res.user.userCategory);
        setAvatarUrl(res.user.avatarUrl || '');
        setEmailNotifications(res.user.preferences.emailNotifications);
        setDefaultMarker(res.user.preferences.defaultMarker);
        setDefaultDatabase(res.user.preferences.defaultDatabase);
      })
      .catch(() => {});
  }, []);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError('Profile photo must be smaller than 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          institution,
          department,
          researchField,
          country,
          userCategory,
          avatarUrl: avatarUrl || null,
          preferences: {
            emailNotifications,
            defaultMarker,
            defaultDatabase,
          },
        }),
      });
      await refreshProfile();
      setMessage('Profile and preferences saved.');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPw) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await changePassword(newPassword);
      setNewPassword('');
      setConfirmPw('');
      setMessage('Account password updated.');
    } catch (err: any) {
      setError(
        err.message || 'Could not update password. Re-authentication may be required for security.'
      );
    }
  };

  const handleAccountDelete = async () => {
    try {
      await apiFetch('/api/profile/delete-request', { method: 'POST' });
      await logout();
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate account.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#174D35]">
          {mode === 'profile' ? 'Researcher Profile' : 'Account & Analysis Settings'}
        </h1>
        <p className="text-sm text-[#25332C]/75">
          {mode === 'profile'
            ? 'Manage your institutional affiliation, avatar, and recent authentication activity.'
            : 'Configure default bioinformatics parameters, security credentials, and account status.'}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div className="p-4 rounded-xl bg-[#269B68]/10 border border-[#269B68]/30 text-sm text-[#174D35]">
          {message}
        </div>
      )}

      {mode === 'profile' && (
        <div className="grid lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveProfile}
            className="lg:col-span-8 bg-white rounded-xl border border-[#174D35]/12 p-6 space-y-5"
          >
            <div className="flex items-center gap-4 pb-4 border-b border-[#174D35]/10">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover border border-[#174D35]/20"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#174D35] text-white flex items-center justify-center text-xl font-bold">
                  {(fullName || 'R').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-[#174D35]">{dbUser?.email}</div>
                <div className="text-xs font-mono text-[#25332C]/65">
                  Member since{' '}
                  {dbUser?.createdAt ? new Date(dbUser.createdAt).toLocaleDateString() : '—'}
                </div>
                <label className="mt-2 inline-block px-3 py-1 bg-[#F6FAF7] border border-[#174D35]/20 rounded text-xs font-medium text-[#174D35] cursor-pointer">
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">User Category</label>
                <select
                  value={userCategory}
                  onChange={(e) => setUserCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg bg-white"
                >
                  {[
                    'Student',
                    'Research Scholar',
                    'Professor',
                    'Scientist',
                    'Laboratory Researcher',
                    'Environmental Consultant',
                    'Other',
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Institution / University</label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Research Field</label>
                <input
                  type="text"
                  value={researchField}
                  onChange={(e) => setResearchField(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#174D35] hover:bg-[#269B68] text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          <div className="lg:col-span-4 bg-white rounded-xl border border-[#174D35]/12 p-6">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="w-4 h-4 text-[#18A999]" />
              <h2 className="text-base font-semibold text-[#174D35]">Recent Login & Activity</h2>
            </div>
            <div className="divide-y divide-[#174D35]/10 text-xs">
              {activities.slice(0, 10).map((a) => (
                <div key={a.id} className="py-2.5">
                  <div className="font-medium text-[#25332C]">{a.details || a.action}</div>
                  <div className="font-mono text-[#25332C]/55">
                    {new Date(a.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === 'settings' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleSaveProfile}
            className="bg-white rounded-xl border border-[#174D35]/12 p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-[#174D35]">Workflow Preferences</h2>
            <div>
              <label className="block text-xs font-semibold mb-1">Default Marker Region</label>
              <select
                value={defaultMarker}
                onChange={(e) => setDefaultMarker(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg bg-white"
              >
                {['16S rRNA', '18S rRNA', 'COI', 'ITS', '12S rRNA', 'rbcL', 'matK'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Default Reference Database</label>
              <select
                value={defaultDatabase}
                onChange={(e) => setDefaultDatabase(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg bg-white"
              >
                {['SILVA', 'NCBI GenBank', 'BOLD Systems', 'UNITE', 'MIDORI'].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#25332C] cursor-pointer">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="rounded border-[#174D35]/30"
              />
              Enable analysis completion & report notifications
            </label>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#174D35] hover:bg-[#269B68] text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              Save Preferences
            </button>
          </form>

          <div className="space-y-6">
            <form
              onSubmit={handlePasswordChange}
              className="bg-white rounded-xl border border-[#174D35]/12 p-6 space-y-4"
            >
              <h2 className="text-base font-semibold text-[#174D35]">Change Password</h2>
              {firebaseUser?.providerData?.[0]?.providerId === 'google.com' && (
                <p className="text-xs text-[#25332C]/70">
                  Signed in via Google OAuth. Password management applies only if you also use
                  Email/Password credentials.
                </p>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (8+ chars)"
                  className="px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Confirm new password"
                  className="px-3 py-2 text-sm border border-[#174D35]/20 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-[#174D35] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Update Password
              </button>
            </form>

            <div className="bg-white rounded-xl border border-red-200 p-6 space-y-3">
              <div className="flex items-center gap-2 text-red-700">
                <ShieldAlert className="w-4 h-4" />
                <h2 className="text-base font-semibold">Account Deletion Request</h2>
              </div>
              <p className="text-xs text-[#25332C]/80">
                Deactivating your researcher account disables workspace sign-in while preserving
                institutional audit integrity.
              </p>
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Request Account Deactivation
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#174D35]/15 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-red-700">Confirm Account Deactivation</h3>
            <p className="text-sm text-[#25332C]/80">
              Are you sure you want to deactivate your researcher account and sign out immediately?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="px-4 py-2 text-xs font-medium text-[#25332C]/70 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAccountDelete}
                className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Deactivate Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
