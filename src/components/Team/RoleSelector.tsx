'use client';

import { useState } from 'react';
import { Role, ROLE_DEFINITIONS } from '@/types/permissions';
import { getRoleColorClass } from '@/lib/permissions';

interface RoleSelectorProps {
  currentRole: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
  showDescription?: boolean;
}

export default function RoleSelector({
  currentRole,
  onChange,
  disabled = false,
  showDescription = true,
}: RoleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleRoleSelect = (role: Role) => {
    onChange(role);
    setIsOpen(false);
  };

  const currentRoleDef = ROLE_DEFINITIONS[currentRole];

  return (
    <div className="relative">
      {/* Selected Role Display */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors
          ${disabled ? 'cursor-not-allowed bg-gray-50' : 'hover:bg-gray-50'}
          ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'}
        `}
      >
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleColorClass(currentRole, 'bg')} ${getRoleColorClass(currentRole, 'text')}`}>
            {currentRoleDef.label}
          </span>
          {showDescription && (
            <span className="text-gray-500">{currentRoleDef.description}</span>
          )}
        </div>
        {!disabled && (
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Options */}
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            {(Object.keys(ROLE_DEFINITIONS) as Role[]).map((role) => {
              const roleDef = ROLE_DEFINITIONS[role];
              const isSelected = role === currentRole;

              return (
                <button
                  key={role}
                  onClick={() => handleRoleSelect(role)}
                  className={`
                    flex w-full flex-col gap-1 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0
                    ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleColorClass(role, 'bg')} ${getRoleColorClass(role, 'text')}`}>
                      {roleDef.label}
                    </span>
                    {isSelected && (
                      <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{roleDef.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {roleDef.permissions.map((permission) => (
                      <span
                        key={permission}
                        className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
