export type Role = 'admin' | 'manager' | 'analyst' | 'viewer';

export type Permission = 'view' | 'edit' | 'approve' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string;
  createdAt: Date;
  lastActive?: Date;
}

export interface TeamMember extends User {
  invitedBy?: string;
  status: 'active' | 'invited' | 'inactive';
}

export interface RoleDefinition {
  role: Role;
  label: string;
  description: string;
  permissions: Permission[];
  color: string;
  icon: string;
}

export interface InviteRequest {
  email: string;
  role: Role;
  message?: string;
}

export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  admin: {
    role: 'admin',
    label: 'Admin',
    description: 'Full access to all features including team management',
    permissions: ['view', 'edit', 'approve', 'admin'],
    color: 'purple',
    icon: 'shield',
  },
  manager: {
    role: 'manager',
    label: 'Manager',
    description: 'Can view, edit campaigns, and approve changes',
    permissions: ['view', 'edit', 'approve'],
    color: 'blue',
    icon: 'user-check',
  },
  analyst: {
    role: 'analyst',
    label: 'Analyst',
    description: 'Can view and edit campaigns but cannot approve',
    permissions: ['view', 'edit'],
    color: 'green',
    icon: 'chart',
  },
  viewer: {
    role: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to campaigns and reports',
    permissions: ['view'],
    color: 'gray',
    icon: 'eye',
  },
};

export interface PermissionCheck {
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: Role) => boolean;
  canEdit: () => boolean;
  canApprove: () => boolean;
  canManageTeam: () => boolean;
}
