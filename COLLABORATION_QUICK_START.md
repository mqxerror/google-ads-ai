# Collaboration Features - Quick Start Guide

## Installation

All files are already created. No additional packages needed beyond the existing dependencies.

## Quick Integration

### Step 1: Add Providers

Edit `/src/components/Providers.tsx`:

```tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AccountProvider } from '@/contexts/AccountContext';
import { ActionQueueProvider } from '@/contexts/ActionQueueContext';
import { GuardrailsProvider } from '@/contexts/GuardrailsContext';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { ApprovalsProvider } from '@/contexts/ApprovalsContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <PermissionsProvider>
          <AccountProvider>
            <GuardrailsProvider>
              <ActionQueueProvider>
                <ApprovalsProvider>
                  {children}
                </ApprovalsProvider>
              </ActionQueueProvider>
            </GuardrailsProvider>
          </AccountProvider>
        </PermissionsProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
```

### Step 2: Use Anywhere in Your App

#### Team Management

```tsx
import { TeamManagement } from '@/components/Team';
import { useState } from 'react';

function SettingsPage() {
  const [showTeam, setShowTeam] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowTeam(true)}>
        Manage Team
      </button>
      
      <TeamManagement 
        isOpen={showTeam}
        onClose={() => setShowTeam(false)}
      />
    </div>
  );
}
```

#### Comments

```tsx
import { CommentsPanel } from '@/components/Comments';
import { useState } from 'react';

function CampaignRow({ campaign }) {
  const [showComments, setShowComments] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowComments(true)}>
        💬 Comments
      </button>
      
      <CommentsPanel
        entityType="campaign"
        entityId={campaign.id}
        entityName={campaign.name}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
      />
    </div>
  );
}
```

#### Approvals

```tsx
import { ApprovalQueue, RequestApproval } from '@/components/Approvals';
import { useApprovals } from '@/contexts/ApprovalsContext';
import { useState } from 'react';

function Header() {
  const { pendingRequests } = useApprovals();
  const [showQueue, setShowQueue] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowQueue(true)}>
        Approvals {pendingRequests.length > 0 && `(${pendingRequests.length})`}
      </button>
      
      <ApprovalQueue
        isOpen={showQueue}
        onClose={() => setShowQueue(false)}
      />
    </div>
  );
}
```

#### Permission Checks

```tsx
import { usePermissions } from '@/contexts/PermissionsContext';

function BudgetEditor() {
  const { checks, currentUser } = usePermissions();
  
  return (
    <div>
      {checks.canEdit() && (
        <button>Edit Campaign</button>
      )}
      
      {checks.canApprove() && (
        <button>Approve Changes</button>
      )}
      
      {checks.canManageTeam() && (
        <button>Team Settings</button>
      )}
    </div>
  );
}
```

## Component Props Reference

### TeamManagement

```tsx
interface TeamManagementProps {
  isOpen: boolean;
  onClose: () => void;
}
```

### CommentsPanel

```tsx
interface CommentsPanelProps {
  entityType: 'campaign' | 'adGroup' | 'keyword' | 'ad';
  entityId: string;
  entityName?: string;
  isOpen: boolean;
  onClose: () => void;
}
```

### ApprovalQueue

```tsx
interface ApprovalQueueProps {
  isOpen: boolean;
  onClose: () => void;
}
```

### RequestApproval

```tsx
interface RequestApprovalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: CreateApprovalRequest) => Promise<void>;
  prefillData?: {
    changeType?: ApprovalChangeType;
    entityType?: 'campaign' | 'adGroup' | 'keyword' | 'ad';
    entityId?: string;
    entityName?: string;
    changes?: ApprovalChange[];
  };
}
```

## Hook Usage

### usePermissions

```tsx
const {
  currentUser,      // Current user object
  userRole,         // Current user's role
  permissions,      // Array of permissions
  checks,           // Permission checking functions
  isLoading,        // Loading state
  updateUserRole,   // Update role (for testing)
} = usePermissions();

// Check functions
checks.hasPermission('edit')  // Check specific permission
checks.hasRole('admin')       // Check specific role
checks.canEdit()              // Can edit campaigns
checks.canApprove()           // Can approve changes
checks.canManageTeam()        // Can manage team
```

### useApprovals

```tsx
const {
  approvalRequests,      // All approval requests
  pendingRequests,       // Pending requests only
  stats,                 // Statistics object
  isLoading,             // Loading state
  error,                 // Error message
  createApprovalRequest, // Create new request
  reviewApprovalRequest, // Approve/reject request
  cancelApprovalRequest, // Cancel request
  refreshRequests,       // Reload data
} = useApprovals();
```

## Common Patterns

### Add Comments Button to Campaign Grid

```tsx
import { CommentsPanel } from '@/components/Comments';

function CampaignGrid({ campaigns }) {
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  
  return (
    <>
      {campaigns.map(campaign => (
        <div key={campaign.id}>
          <span>{campaign.name}</span>
          <button onClick={() => setSelectedCampaign(campaign)}>
            💬 Comments
          </button>
        </div>
      ))}
      
      {selectedCampaign && (
        <CommentsPanel
          entityType="campaign"
          entityId={selectedCampaign.id}
          entityName={selectedCampaign.name}
          isOpen={!!selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </>
  );
}
```

### Request Approval for Budget Change

```tsx
import { RequestApproval } from '@/components/Approvals';
import { useApprovals } from '@/contexts/ApprovalsContext';
import { requiresApproval } from '@/types/approvals';

function BudgetEditor({ campaign, currentBudget, newBudget }) {
  const { createApprovalRequest } = useApprovals();
  const [showApproval, setShowApproval] = useState(false);
  
  const handleSave = async () => {
    const budgetChange = newBudget - currentBudget;
    
    if (requiresApproval('budget_increase', budgetChange)) {
      setShowApproval(true);
    } else {
      await saveBudget(newBudget);
    }
  };
  
  return (
    <>
      <button onClick={handleSave}>Save Budget</button>
      
      <RequestApproval
        isOpen={showApproval}
        onClose={() => setShowApproval(false)}
        onSubmit={createApprovalRequest}
        prefillData={{
          changeType: 'budget_increase',
          entityType: 'campaign',
          entityId: campaign.id,
          entityName: campaign.name,
          changes: [{
            field: 'budget',
            currentValue: currentBudget,
            newValue: newBudget,
            displayLabel: 'Daily Budget',
          }],
        }}
      />
    </>
  );
}
```

### Role-based UI

```tsx
import { usePermissions } from '@/contexts/PermissionsContext';

function CampaignActions({ campaign }) {
  const { checks } = usePermissions();
  
  return (
    <div className="flex gap-2">
      {/* Everyone can view */}
      <button>View Details</button>
      
      {/* Only editors and above */}
      {checks.canEdit() && (
        <button>Edit Campaign</button>
      )}
      
      {/* Only managers and admins */}
      {checks.canApprove() && (
        <button>Approve Changes</button>
      )}
      
      {/* Only admins */}
      {checks.canManageTeam() && (
        <button>Delete Campaign</button>
      )}
    </div>
  );
}
```

## Utility Functions

### Permission Utilities

```tsx
import {
  hasPermission,
  canPerformAction,
  getRoleColorClass,
  isValidEmail,
} from '@/lib/permissions';

// Check permission for a role
hasPermission('manager', 'approve') // true
hasPermission('analyst', 'approve') // false

// Check if role can perform action
canPerformAction('admin', 'delete') // true
canPerformAction('viewer', 'delete') // false

// Get Tailwind color class for role
getRoleColorClass('admin', 'bg')   // 'bg-purple-100'
getRoleColorClass('admin', 'text') // 'text-purple-700'

// Validate email
isValidEmail('user@company.com') // true
isValidEmail('invalid-email')    // false
```

### Approval Utilities

```tsx
import {
  getPriorityLevel,
  requiresApproval,
} from '@/types/approvals';

// Get priority based on change type and impact
const priority = getPriorityLevel('budget_increase', {
  estimatedSpendChange: 5000,
  affectedEntities: 1,
}); // 'high'

// Check if change requires approval
const needsApproval = requiresApproval('budget_increase', 1500);
// true (> $500 threshold)
```

## Styling Guide

All components use Tailwind CSS and follow the existing design system:

- Primary color: Blue (bg-blue-600, text-blue-700)
- Success: Green (bg-green-600)
- Warning: Yellow (bg-yellow-600)
- Error: Red (bg-red-600)
- Neutral: Gray (bg-gray-100)

Spacing follows standard scale (p-4, gap-3, etc.)

## TypeScript Types

All types are fully typed. Import from:

```tsx
import { Role, Permission, User, TeamMember } from '@/types/permissions';
import { Comment, CommentThread, CreateCommentRequest } from '@/types/comments';
import { 
  ApprovalRequest, 
  ApprovalStatus, 
  CreateApprovalRequest 
} from '@/types/approvals';
```

## Next Steps

1. Add providers to your app layout
2. Add Team Management to settings page
3. Add Comments to campaign/entity views
4. Add Approval Queue to header/navigation
5. Implement permission checks throughout the app
6. Connect to your backend APIs

## Testing

Use mock data provided in contexts for testing. To switch to real APIs, update the fetch calls in:

- `/src/contexts/PermissionsContext.tsx`
- `/src/contexts/ApprovalsContext.tsx`
- `/src/components/Team/TeamManagement.tsx`
- `/src/components/Comments/CommentsPanel.tsx`

## Troubleshooting

**Components not showing?**
- Check that providers are added to layout
- Verify isOpen prop is true

**Permission checks not working?**
- Ensure PermissionsProvider wraps your app
- Check currentUser is loaded

**TypeScript errors?**
- Make sure all imports are correct
- Check tsconfig.json includes src directory

For more details, see `COLLABORATION_FEATURES.md`
