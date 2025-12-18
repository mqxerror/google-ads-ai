/**
 * Server-side authentication and authorization utilities
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Role hierarchy - higher roles have more permissions
export const ROLE_HIERARCHY = ['viewer', 'analyst', 'manager', 'admin'] as const;
export type Role = typeof ROLE_HIERARCHY[number];

// Permission types
export type Permission =
  | 'view'
  | 'analyze'
  | 'edit'
  | 'approve'
  | 'delete'
  | 'admin';

// Role to permissions mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: ['view'],
  analyst: ['view', 'analyze'],
  manager: ['view', 'analyze', 'edit', 'approve'],
  admin: ['view', 'analyze', 'edit', 'approve', 'delete', 'admin'],
};

// Action to required permission mapping
export const ACTION_PERMISSIONS: Record<string, Permission> = {
  // Campaign actions
  pause_campaign: 'edit',
  enable_campaign: 'edit',
  update_budget: 'edit',
  // Ad group actions
  pause_ad_group: 'edit',
  enable_ad_group: 'edit',
  update_bid: 'edit',
  // Keyword actions
  pause_keyword: 'edit',
  enable_keyword: 'edit',
  // Bulk operations
  bulk_pause: 'edit',
  bulk_enable: 'edit',
  bulk_update_budget: 'edit',
  // Approval actions
  approve_action: 'approve',
  reject_action: 'approve',
  // Admin actions
  manage_team: 'admin',
  delete_account: 'delete',
};

/**
 * Get the current user with role information
 */
export async function getCurrentUser() {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
    },
  });

  if (!user) {
    return null;
  }

  // For now, default role is admin (since no role field in schema)
  // In production, you'd fetch this from the database
  const role: Role = 'admin';

  return {
    ...user,
    role,
    permissions: ROLE_PERMISSIONS[role],
  };
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(userPermissions: Permission[], requiredPermission: Permission): boolean {
  return userPermissions.includes(requiredPermission);
}

/**
 * Check if user has permission for a specific action
 */
export function hasActionPermission(userPermissions: Permission[], action: string): boolean {
  const requiredPermission = ACTION_PERMISSIONS[action];
  if (!requiredPermission) {
    // Default to requiring edit permission for unknown actions
    return userPermissions.includes('edit');
  }
  return userPermissions.includes(requiredPermission);
}

/**
 * Verify user has permission for an action or return error response
 */
export async function verifyActionPermission(action: string): Promise<{
  authorized: boolean;
  user?: Awaited<ReturnType<typeof getCurrentUser>>;
  errorResponse?: NextResponse;
}> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  if (!hasActionPermission(user.permissions, action)) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        {
          error: 'Forbidden',
          message: `You do not have permission to perform action: ${action}`,
          requiredPermission: ACTION_PERMISSIONS[action] || 'edit',
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user,
  };
}

/**
 * Verify user has a specific permission or return error response
 */
export async function verifyPermission(requiredPermission: Permission): Promise<{
  authorized: boolean;
  user?: Awaited<ReturnType<typeof getCurrentUser>>;
  errorResponse?: NextResponse;
}> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  if (!hasPermission(user.permissions, requiredPermission)) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        {
          error: 'Forbidden',
          message: `You do not have the required permission: ${requiredPermission}`,
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user,
  };
}

/**
 * Verify user owns or has access to a Google Ads account
 */
export async function verifyAccountAccess(
  userEmail: string,
  accountId: string
): Promise<{
  hasAccess: boolean;
  account?: {
    id: string;
    googleAccountId: string;
    isManager: boolean;
    parentManagerId: string | null;
  };
  errorResponse?: NextResponse;
}> {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      googleAdsAccounts: {
        where: {
          OR: [
            { id: accountId },
            { googleAccountId: accountId },
          ],
        },
        select: {
          id: true,
          googleAccountId: true,
          isManager: true,
          parentManagerId: true,
        },
      },
    },
  });

  if (!user) {
    return {
      hasAccess: false,
      errorResponse: NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      ),
    };
  }

  if (user.googleAdsAccounts.length === 0) {
    return {
      hasAccess: false,
      errorResponse: NextResponse.json(
        { error: 'You do not have access to this Google Ads account' },
        { status: 403 }
      ),
    };
  }

  return {
    hasAccess: true,
    account: user.googleAdsAccounts[0],
  };
}
