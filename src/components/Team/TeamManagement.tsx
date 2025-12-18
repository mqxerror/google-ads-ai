'use client';

import { useState, useEffect } from 'react';
import { TeamMember, Role, InviteRequest } from '@/types/permissions';
import { usePermissions } from '@/contexts/PermissionsContext';
import { getRoleColorClass } from '@/lib/permissions';
import RoleSelector from './RoleSelector';
import InviteUser from './InviteUser';

interface TeamManagementProps {
  isOpen?: boolean;
  onClose?: () => void;
}

// Mock data for demo purposes
const MOCK_TEAM_MEMBERS: TeamMember[] = [
  {
    id: '1',
    email: 'admin@company.com',
    name: 'Admin User',
    role: 'admin',
    status: 'active',
    createdAt: new Date('2024-01-15'),
    lastActive: new Date(),
  },
  {
    id: '2',
    email: 'manager@company.com',
    name: 'Marketing Manager',
    role: 'manager',
    status: 'active',
    createdAt: new Date('2024-02-01'),
    lastActive: new Date(),
  },
  {
    id: '3',
    email: 'analyst@company.com',
    name: 'Data Analyst',
    role: 'analyst',
    status: 'active',
    createdAt: new Date('2024-03-10'),
    lastActive: new Date(),
  },
  {
    id: '4',
    email: 'viewer@company.com',
    name: 'Stakeholder',
    role: 'viewer',
    status: 'active',
    createdAt: new Date('2024-03-20'),
  },
  {
    id: '5',
    email: 'pending@company.com',
    name: 'Pending User',
    role: 'analyst',
    status: 'invited',
    createdAt: new Date('2024-12-10'),
  },
];

export default function TeamManagement({ isOpen = true, onClose }: TeamManagementProps) {
  const { checks, currentUser } = usePermissions();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<Role | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'invited' | 'inactive'>('all');

  // Check if being used as standalone page (no onClose) or as panel
  const isStandalone = !onClose;

  useEffect(() => {
    if (!isOpen) return;
    loadTeamMembers();
  }, [isOpen]);

  const loadTeamMembers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // In real implementation, fetch from API
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      setTeamMembers(MOCK_TEAM_MEMBERS);
    } catch (err) {
      console.error('Failed to load team members:', err);
      setError('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteUser = async (invite: InviteRequest) => {
    // In real implementation, call API to send invitation
    console.log('Inviting user:', invite);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Add to team members list
    const newMember: TeamMember = {
      id: Date.now().toString(),
      email: invite.email,
      name: invite.email.split('@')[0],
      role: invite.role,
      status: 'invited',
      createdAt: new Date(),
      invitedBy: currentUser?.id,
    };

    setTeamMembers([...teamMembers, newMember]);
  };

  const handleRoleChange = async (memberId: string, newRole: Role) => {
    try {
      // In real implementation, call API to update role
      console.log('Updating role for member:', memberId, 'to:', newRole);

      setTeamMembers(teamMembers.map(member =>
        member.id === memberId ? { ...member, role: newRole } : member
      ));
    } catch (err) {
      console.error('Failed to update role:', err);
      setError('Failed to update user role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    try {
      // In real implementation, call API to remove member
      console.log('Removing member:', memberId);

      setTeamMembers(teamMembers.filter(member => member.id !== memberId));
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError('Failed to remove team member');
    }
  };

  const handleResendInvite = async (memberId: string) => {
    try {
      // In real implementation, call API to resend invitation
      console.log('Resending invitation for member:', memberId);
      alert('Invitation resent successfully');
    } catch (err) {
      console.error('Failed to resend invitation:', err);
      setError('Failed to resend invitation');
    }
  };

  // Filter members
  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || member.role === filterRole;
    const matchesStatus = filterStatus === 'all' || member.status === filterStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!isOpen) return null;

  // If standalone (no onClose), render as page content
  if (isStandalone) {
    return (
      <div className="bg-white rounded-lg shadow">
        {/* Search and filters */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team members..."
                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            {checks.canManageTeam() && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Invite Member
              </button>
            )}
          </div>
          <div className="mt-4 flex gap-4">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as Role | 'all')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'invited' | 'inactive')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Team members list */}
        <div className="divide-y divide-gray-200">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">No team members found</p>
            </div>
          ) : (
            filteredMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                    {member.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || member.email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{member.name || member.email}</p>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleColorClass(member.role)}`}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    member.status === 'active' ? 'bg-green-100 text-green-700' :
                    member.status === 'invited' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Invite Modal */}
        <InviteUser
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInviteUser}
        />
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl overflow-y-auto bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Team Management</h2>
              <p className="mt-1 text-sm text-gray-500">
                Manage team members and their permissions
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Actions */}
          {checks.canManageTeam() && (
            <div className="mt-4">
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Invite Team Member
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search members..."
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Role Filter */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as Role | 'all')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Team Members List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="rounded-lg bg-gray-50 py-12 text-center">
              <p className="text-sm text-gray-500">No team members found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-start gap-4 rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
                >
                  {/* Avatar */}
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-medium text-white">
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.name} className="h-10 w-10 rounded-full" />
                    ) : (
                      getInitials(member.name)
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{member.name}</h3>
                          <span className={`inline-flex h-2 w-2 rounded-full ${
                            member.status === 'active' ? 'bg-green-500' :
                            member.status === 'invited' ? 'bg-yellow-500' :
                            'bg-gray-400'
                          }`} />
                        </div>
                        <p className="mt-0.5 text-sm text-gray-500">{member.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                          <span>Joined {formatDate(member.createdAt)}</span>
                          {member.lastActive && (
                            <span>Last active {formatDate(member.lastActive)}</span>
                          )}
                          {member.status === 'invited' && (
                            <span className="text-yellow-600">Pending invitation</span>
                          )}
                        </div>
                      </div>

                      {/* Role & Actions */}
                      <div className="flex items-start gap-2">
                        {checks.canManageTeam() && member.id !== currentUser?.id ? (
                          <div className="w-48">
                            <RoleSelector
                              currentRole={member.role}
                              onChange={(newRole) => handleRoleChange(member.id, newRole)}
                              showDescription={false}
                            />
                          </div>
                        ) : (
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getRoleColorClass(member.role, 'bg')} ${getRoleColorClass(member.role, 'text')}`}>
                            {member.role}
                          </span>
                        )}

                        {checks.canManageTeam() && member.id !== currentUser?.id && (
                          <div className="relative">
                            <button
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              onClick={() => {
                                if (member.status === 'invited') {
                                  handleResendInvite(member.id);
                                } else {
                                  handleRemoveMember(member.id);
                                }
                              }}
                            >
                              {member.status === 'invited' ? (
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              ) : (
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="mt-6 rounded-lg bg-gray-50 p-4">
            <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
              <div>
                <div className="text-2xl font-semibold text-gray-900">{teamMembers.length}</div>
                <div className="text-xs text-gray-500">Total Members</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-green-600">
                  {teamMembers.filter(m => m.status === 'active').length}
                </div>
                <div className="text-xs text-gray-500">Active</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-yellow-600">
                  {teamMembers.filter(m => m.status === 'invited').length}
                </div>
                <div className="text-xs text-gray-500">Invited</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-purple-600">
                  {teamMembers.filter(m => m.role === 'admin').length}
                </div>
                <div className="text-xs text-gray-500">Admins</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <InviteUser
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInviteUser}
      />
    </>
  );
}
