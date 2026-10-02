import React, { useState, useEffect } from 'react';
import {
  Users, Search, Plus, MoreVertical, Mail, Shield, Clock, UserCheck,
  UserX, Trash2, Edit2, ChevronLeft, ChevronRight, Filter, Download,
  UserPlus, Eye, X, CheckCircle2, AlertTriangle, AlertCircle
} from 'lucide-react';
import { useUsers, useUsersStats } from '../../hooks/useApi';
import { apiClient } from '../../lib/api';
import type { User as UserType, UserRole as UserRoleType } from '../../types/api';

// ─── Reusable Components ────────────────────────────────────────────────────

const StatusDot = ({ status }: { status: UserType['status'] }) => {
  const colors: Record<string, string> = {
    active: 'bg-success',
    inactive: 'bg-text-secondary',
    suspended: 'bg-danger',
    pending: 'bg-warning',
  };
  return <span className={`w-2 h-2 rounded-full ${colors[status]} ${status === 'active' ? 'animate-pulse' : ''}`} />;
};

const RoleBadge = ({ role }: { role: UserRoleType }) => {
  const styles: Record<string, string> = {
    'Super Admin': 'bg-primary/15 text-primary border-primary/30',
    'Security Admin': 'bg-success/15 text-success border-success/30',
    'Analyst': 'bg-warning/15 text-warning border-warning/30',
    'Viewer': 'bg-text-secondary/15 text-text-secondary border-text-secondary/30',
    'API User': 'bg-danger/15 text-danger border-danger/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${styles[role]}`}>
      {role}
    </span>
  );
};

// ─── Invite Modal ───────────────────────────────────────────────────────────

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: UserRoleType) => Promise<void>;
  isLoading?: boolean;
}

const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, onSubmit, isLoading = false }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRoleType>('Analyst');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email) {
      setError('Email is required');
      return;
    }

    try {
      setError(null);
      await onSubmit(email, role);
      setEmail('');
      setRole('Analyst');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in">
      <div className="bg-surface border border-border/40 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <UserPlus size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text">Invite Team Member</h3>
              <p className="text-xs text-text-secondary">Send an invitation via email</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text transition-colors p-1 rounded-lg hover:bg-border/20">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Email Address</label>
            <div className="flex items-center gap-2 bg-bg border border-border/40 rounded-lg px-3 py-2.5 focus-within:border-primary/50 transition-colors">
              <Mail size={16} className="text-text-secondary" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="flex-1 bg-transparent text-sm text-text placeholder:text-text-secondary/50 outline-none"
                disabled={isLoading}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Assign Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRoleType)}
              className="w-full bg-bg border border-border/40 rounded-lg px-3 py-2.5 text-sm text-text outline-none focus:border-primary/50 transition-colors"
              disabled={isLoading}
            >
              <option value="Security Admin">Security Admin</option>
              <option value="Analyst">Analyst</option>
              <option value="Viewer">Viewer</option>
              <option value="API User">API User</option>
            </select>
          </div>

          {error && (
            <div className="bg-danger/5 border border-danger/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={14} className="text-danger mt-0.5 flex-shrink-0" />
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <p className="text-xs text-text-secondary">
              <span className="font-medium text-primary">Note:</span> An invitation link will be sent to the email address. The link expires in 72 hours.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text transition-colors rounded-lg border border-border/40 hover:bg-bg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors rounded-lg shadow-sm disabled:opacity-50"
          >
            <Mail size={14} className="inline mr-2" />
            {isLoading ? 'Sending...' : 'Send Invitation'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const UserManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [isInviteLoading, setIsInviteLoading] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const perPage = 6;

  // Fetch users data
  const { data: usersData, loading: usersLoading, error: usersError, refetch: refetchUsers } = useUsers({
    role: filterRole === 'all' ? undefined : filterRole,
    status: filterStatus === 'all' ? undefined : filterStatus,
    search: searchQuery || undefined,
    limit: 100,
    refreshInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch users stats
  const { data: statsData, loading: statsLoading, refetch: refetchStats } = useUsersStats(30000);

  // Get all users from API response
  const allUsers = usersData?.items || [];

  // Handle invite submission
  const handleInviteSubmit = async (email: string, role: UserRoleType) => {
    setIsInviteLoading(true);
    try {
      await apiClient.createUser({ email, role });
      await refetchUsers();
      await refetchStats();
    } finally {
      setIsInviteLoading(false);
    }
  };

  // Handle bulk action
  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (!selectedUsers.length) return;

    setBulkActionLoading(true);
    try {
      await apiClient.bulkUserAction({
        user_ids: selectedUsers,
        action,
      });
      setSelectedUsers([]);
      await refetchUsers();
      await refetchStats();
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Handle delete user
  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await apiClient.deleteUser(userId);
        setOpenActionMenu(null);
        await refetchUsers();
        await refetchStats();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete user');
      }
    }
  };

  // Pagination
  const totalPages = Math.ceil((usersData?.total || 0) / perPage);
  const pagedUsers = allUsers.slice((currentPage - 1) * perPage, currentPage * perPage);

  const toggleSelectUser = (id: string) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === pagedUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(pagedUsers.map(u => u.id));
    }
  };

  const stats = {
    total: statsData?.total_users || 0,
    active: statsData?.active_users || 0,
    inactive: statsData?.inactive_users || 0,
    pending: statsData?.pending_invites || 0,
  };

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen text-text p-2 sm:p-4 md:p-8 space-y-6">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/20">
        <div>
          <h1 className="text-2xl font-normal tracking-tight text-text">User Management</h1>
          <p className="text-xs text-text-secondary mt-1">Manage team members, roles, and access permissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-secondary bg-surface border border-border/40 rounded-lg hover:text-text hover:border-border transition-colors">
            <Download size={14} />
            Export
          </button>
          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors"
          >
            <Plus size={14} />
            Invite User
          </button>
        </div>
      </div>

      {/* ─── Error State ─── */}
      {usersError && (
        <div className="bg-danger/5 border border-danger/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-danger mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-danger">Error loading users</p>
            <p className="text-xs text-text-secondary mt-1">{usersError}</p>
          </div>
        </div>
      )}

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.total, icon: Users, color: 'primary' },
          { label: 'Active Now', value: stats.active, icon: UserCheck, color: 'success' },
          { label: 'Inactive', value: stats.inactive, icon: UserX, color: 'danger' },
          { label: 'Pending Invite', value: stats.pending, icon: Clock, color: 'warning' },
        ].map(stat => (
          <div key={stat.label} className="bg-surface border border-border/40 rounded-xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl bg-${stat.color}/15 flex items-center justify-center`}>
              <stat.icon size={20} className={`text-${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-text">{stat.value}</p>
              <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Filters & Search ─── */}
      <div className="bg-surface border border-border/40 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 bg-bg border border-border/40 rounded-lg px-3 py-2 focus-within:border-primary/50 transition-colors">
            <Search size={16} className="text-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="flex-1 bg-transparent text-sm text-text placeholder:text-text-secondary/50 outline-none"
              disabled={usersLoading}
            />
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-text-secondary" />
              <select
                value={filterRole}
                onChange={(e) => {
                  setFilterRole(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-bg border border-border/40 rounded-lg px-3 py-2 text-xs text-text outline-none focus:border-primary/50 transition-colors"
                disabled={usersLoading}
              >
                <option value="all">All Roles</option>
                <option value="Super Admin">Super Admin</option>
                <option value="Security Admin">Security Admin</option>
                <option value="Analyst">Analyst</option>
                <option value="Viewer">Viewer</option>
                <option value="API User">API User</option>
              </select>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-bg border border-border/40 rounded-lg px-3 py-2 text-xs text-text outline-none focus:border-primary/50 transition-colors"
              disabled={usersLoading}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedUsers.length > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/20">
            <span className="text-xs text-text-secondary">{selectedUsers.length} selected</span>
            <button
              onClick={() => handleBulkAction('activate')}
              disabled={bulkActionLoading}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              Activate
            </button>
            <button
              onClick={() => handleBulkAction('deactivate')}
              disabled={bulkActionLoading}
              className="text-xs font-medium text-warning hover:underline disabled:opacity-50"
            >
              Deactivate
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              disabled={bulkActionLoading}
              className="text-xs font-medium text-danger hover:underline disabled:opacity-50"
            >
              Delete
            </button>
            <button
              className="text-xs font-medium text-text-secondary hover:underline"
              onClick={() => setSelectedUsers([])}
              disabled={bulkActionLoading}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ─── Users Table ─── */}
      <div className="bg-surface border border-border/40 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="text-[10px] text-text-secondary uppercase tracking-widest bg-bg/50 border-b border-border/20">
            <tr>
              <th className="px-5 py-3.5">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === pagedUsers.length && pagedUsers.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-border accent-primary"
                  disabled={usersLoading}
                />
              </th>
              <th className="px-5 py-3.5 font-medium">User</th>
              <th className="px-5 py-3.5 font-medium">Role</th>
              <th className="px-5 py-3.5 font-medium">Status</th>
              <th className="px-5 py-3.5 font-medium">Last Active</th>
              <th className="px-5 py-3.5 font-medium">Scans</th>
              <th className="px-5 py-3.5 font-medium">MFA</th>
              <th className="px-5 py-3.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {usersLoading ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary/50 animate-pulse"></div>
                    <span className="text-xs text-text-secondary">Loading users...</span>
                  </div>
                </td>
              </tr>
            ) : pagedUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center">
                  <span className="text-xs text-text-secondary">No users found</span>
                </td>
              </tr>
            ) : (
              pagedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-border/5 transition-colors group">
                  <td className="px-5 py-4">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleSelectUser(user.id)}
                      className="rounded border-border accent-primary"
                    />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm">
                        {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text group-hover:text-primary transition-colors">{user.name}</p>
                        <p className="text-[10px] text-text-secondary">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><RoleBadge role={user.role} /></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <StatusDot status={user.status} />
                      <span className="text-xs text-text capitalize">{user.status}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-text-secondary">{user.last_active}</td>
                  <td className="px-5 py-4 text-xs text-text font-mono">{user.scans_run.toLocaleString()}</td>
                  <td className="px-5 py-4">
                    {user.mfa_enabled ? (
                      <CheckCircle2 size={16} className="text-success" />
                    ) : (
                      <AlertTriangle size={16} className="text-warning/60" />
                    )}
                  </td>
                  <td className="px-5 py-4 text-right relative">
                    <button
                      onClick={() => setOpenActionMenu(openActionMenu === user.id ? null : user.id)}
                      className="p-1.5 rounded-lg hover:bg-border/20 text-text-secondary hover:text-text transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openActionMenu === user.id && (
                      <div className="absolute right-5 top-12 bg-surface border border-border/40 rounded-lg shadow-xl z-20 w-40 py-1 animate-in">
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-border/10 transition-colors">
                          <Eye size={14} /> View Profile
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-border/10 transition-colors">
                          <Edit2 size={14} /> Edit User
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-border/10 transition-colors">
                          <Shield size={14} /> Change Role
                        </button>
                        <hr className="my-1 border-border/20" />
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-danger/10 transition-colors"
                        >
                          <Trash2 size={14} /> Delete User
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/20 bg-bg/30">
          <span className="text-[10px] text-text-secondary">
            Showing {allUsers.length === 0 ? 0 : ((currentPage - 1) * perPage) + 1}–{Math.min(currentPage * perPage, usersData?.total || 0)} of {usersData?.total || 0}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || usersLoading}
              className="p-1.5 rounded-lg hover:bg-border/20 text-text-secondary disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                disabled={usersLoading}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                  page === currentPage ? 'bg-primary text-white' : 'text-text-secondary hover:bg-border/20 disabled:opacity-30'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || usersLoading}
              className="p-1.5 rounded-lg hover:bg-border/20 text-text-secondary disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onSubmit={handleInviteSubmit}
        isLoading={isInviteLoading}
      />
    </div>
  );
};
