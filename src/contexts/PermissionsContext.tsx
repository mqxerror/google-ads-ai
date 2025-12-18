'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { Role, Permission, User, ROLE_DEFINITIONS, PermissionCheck } from '@/types/permissions';

interface PermissionsContextType {
  currentUser: User | null;
  userRole: Role;
  permissions: Permission[];
  checks: PermissionCheck;
  isLoading: boolean;
  updateUserRole: (role: Role) => void;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<Role>('viewer');
  const [isLoading, setIsLoading] = useState(true);

  // Load user profile and role
  useEffect(() => {
    async function loadUserProfile() {
      if (status === 'loading') return;

      if (!session?.user) {
        setCurrentUser(null);
        setUserRole('viewer');
        setIsLoading(false);
        return;
      }

      try {
        // In a real implementation, fetch user profile from API
        // For now, create a basic user object
        const user: User = {
          id: session.user.email || 'unknown',
          email: session.user.email || '',
          name: session.user.name || 'User',
          role: 'admin', // Default to admin for demo purposes
          avatar: session.user.image || undefined,
          createdAt: new Date(),
          lastActive: new Date(),
        };

        setCurrentUser(user);
        setUserRole(user.role);
      } catch (error) {
        console.error('Failed to load user profile:', error);
        setUserRole('viewer'); // Fallback to viewer on error
      } finally {
        setIsLoading(false);
      }
    }

    loadUserProfile();
  }, [session, status]);

  // Get permissions based on role
  const permissions = ROLE_DEFINITIONS[userRole]?.permissions || [];

  // Permission checking utilities
  const checks: PermissionCheck = {
    hasPermission: (permission: Permission) => {
      return permissions.includes(permission);
    },
    hasRole: (role: Role) => {
      return userRole === role;
    },
    canEdit: () => {
      return permissions.includes('edit');
    },
    canApprove: () => {
      return permissions.includes('approve');
    },
    canManageTeam: () => {
      return permissions.includes('admin');
    },
  };

  const updateUserRole = (role: Role) => {
    setUserRole(role);
    if (currentUser) {
      setCurrentUser({ ...currentUser, role });
    }
  };

  return (
    <PermissionsContext.Provider
      value={{
        currentUser,
        userRole,
        permissions,
        checks,
        isLoading,
        updateUserRole,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
