import { Upload } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { apiClient, extractApiError } from '../api/client';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import type { UploadedImage } from '../types';

export function ProfilePage() {
  const { user, counts, updateProfile, refreshProfile } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [role, setRole] = useState(user?.role || '');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setAvatarError(null);
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setAvatarError('Only JPG, PNG, WebP, or GIF images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Avatar image must be 5 MB or smaller.');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('title', `${user?.name || 'User'} Avatar`);

    setAvatarUploading(true);
    try {
      const { data } = await apiClient.post<{ upload: UploadedImage }>('/uploads', formData);
      await updateProfile({ avatarUrl: data.upload.url });
      await refreshProfile();
    } catch (err) {
      setAvatarError(extractApiError(err, 'Failed to update avatar.').message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    setProfileError(null);

    if (name.trim().length < 2 || name.trim().length > 80) {
      setProfileError('Name must be between 2 and 80 characters.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), role: role.trim() });
      setProfileMessage('Profile details updated.');
    } catch (err) {
      setProfileError(extractApiError(err, 'Unable to update profile.').message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError('New password must be at least 6 characters with letters and numbers.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await apiClient.patch('/auth/password', { currentPassword, newPassword });
      setPasswordMessage('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(extractApiError(err, 'Unable to change password.').message);
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = (user?.name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('');

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Account Settings
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage your profile identity, avatar upload, and security credentials.
          </p>
        </div>

        {/* Account Overview & Avatar */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-slate-900 text-white font-display text-lg font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
            )}
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-900">{user?.name}</h3>
              <p className="text-sm text-slate-600">{user?.email}</p>
              <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                {counts.totalTasks} tasks · {counts.completedTasks} completed · {counts.uploads} uploads
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              <span>{avatarUploading ? 'Uploading...' : 'Upload Avatar'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarUpload}
                disabled={avatarUploading}
                className="sr-only"
              />
            </label>
            {avatarError && <p className="text-xs text-red-600">{avatarError}</p>}
          </div>
        </section>

        {/* Profile Form */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-display text-base font-semibold text-slate-900 mb-4">
            Profile Details
          </h3>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            {profileError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {profileError}
              </div>
            )}
            {profileMessage && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {profileMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Full name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label htmlFor="profile-role" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Role
                </label>
                <input
                  id="profile-role"
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </section>

        {/* Password Form */}
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-display text-base font-semibold text-slate-900 mb-4">
            Change Password
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {passwordError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {passwordError}
              </div>
            )}
            {passwordMessage && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {passwordMessage}
              </div>
            )}

            <div>
              <label htmlFor="cur-pass" className="block text-sm font-medium text-slate-700 mb-1.5">
                Current password
              </label>
              <input
                id="cur-pass"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-pass" className="block text-sm font-medium text-slate-700 mb-1.5">
                  New password
                </label>
                <input
                  id="new-pass"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label htmlFor="confirm-pass" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirm new password
                </label>
                <input
                  id="confirm-pass"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPassword}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppLayout>
  );
}
