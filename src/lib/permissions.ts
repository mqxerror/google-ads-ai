import { Role, Permission, ROLE_DEFINITIONS } from '@/types/permissions';

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const roleDefinition = ROLE_DEFINITIONS[role];
  if (!roleDefinition) return false;
  return roleDefinition.permissions.includes(permission);
}

/**
 * Check if a role can perform an action
 */
export function canPerformAction(
  role: Role,
  action: 'view' | 'edit' | 'approve' | 'delete' | 'invite' | 'manageTeam'
): boolean {
  switch (action) {
    case 'view':
      return hasPermission(role, 'view');
    case 'edit':
      return hasPermission(role, 'edit');
    case 'approve':
      return hasPermission(role, 'approve');
    case 'delete':
      return hasPermission(role, 'admin');
    case 'invite':
      return hasPermission(role, 'admin') || hasPermission(role, 'approve');
    case 'manageTeam':
      return hasPermission(role, 'admin');
    default:
      return false;
  }
}

/**
 * Get the highest priority role from a list of roles
 */
export function getHighestRole(roles: Role[]): Role {
  const rolePriority: Record<Role, number> = {
    admin: 4,
    manager: 3,
    analyst: 2,
    viewer: 1,
  };

  return roles.reduce((highest, current) => {
    return rolePriority[current] > rolePriority[highest] ? current : highest;
  }, 'viewer' as Role);
}

/**
 * Check if a role is higher or equal to another role
 */
export function isRoleHigherOrEqual(role: Role, compareRole: Role): boolean {
  const rolePriority: Record<Role, number> = {
    admin: 4,
    manager: 3,
    analyst: 2,
    viewer: 1,
  };

  return rolePriority[role] >= rolePriority[compareRole];
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_DEFINITIONS[role]?.permissions || [];
}

/**
 * Check if a role can assign another role to a user
 */
export function canAssignRole(assignerRole: Role, targetRole: Role): boolean {
  // Only admins can assign roles
  if (!hasPermission(assignerRole, 'admin')) return false;

  // Admins can assign any role
  return true;
}

/**
 * Get role color class for Tailwind
 */
export function getRoleColorClass(role: Role, type: 'bg' | 'text' | 'border' = 'bg'): string {
  const roleColors: Record<Role, Record<typeof type, string>> = {
    admin: {
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      border: 'border-purple-300',
    },
    manager: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      border: 'border-blue-300',
    },
    analyst: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-300',
    },
    viewer: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      border: 'border-gray-300',
    },
  };

  return roleColors[role]?.[type] || '';
}

/**
 * Validate an email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
