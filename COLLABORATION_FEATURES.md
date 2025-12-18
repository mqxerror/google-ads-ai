# Collaboration Features Implementation

This document describes the newly implemented collaboration features for the Google Ads Manager application.

## Overview

Three major collaboration features have been implemented:

1. **Multi-user Roles & Permissions** - Role-based access control system
2. **Comments/Notes System** - Commenting capability on campaigns and entities
3. **Approval Workflows** - Approval system for high-impact changes

## File Structure

```
src/
├── types/
│   ├── permissions.ts          # Role and permission type definitions
│   ├── comments.ts              # Comment type definitions
│   └── approvals.ts             # Approval workflow type definitions
├── contexts/
│   ├── PermissionsContext.tsx   # Permissions state management
│   └── ApprovalsContext.tsx     # Approvals state management
├── lib/
│   └── permissions.ts           # Permission checking utilities
└── components/
    ├── Team/
    │   ├── TeamManagement.tsx   # Team/user management panel
    │   ├── RoleSelector.tsx     # Role assignment dropdown
    │   ├── InviteUser.tsx       # Invite new users modal
    │   └── index.ts             # Exports
    ├── Comments/
    │   ├── CommentsPanel.tsx    # Comments sidebar/panel
    │   ├── CommentThread.tsx    # Thread display with replies
    │   ├── CommentInput.tsx     # Add comment form with @mentions
    │   └── index.ts             # Exports
    └── Approvals/
        ├── ApprovalQueue.tsx    # Pending approvals list
        ├── ApprovalRequest.tsx  # Request detail view
        ├── RequestApproval.tsx  # Request approval modal
        └── index.ts             # Exports
```

## Feature 1: Multi-user Roles & Permissions

### Roles

Four hierarchical roles are defined:

- **Admin** - Full access including team management
- **Manager** - Can view, edit campaigns, and approve changes
- **Analyst** - Can view and edit campaigns (cannot approve)
- **Viewer** - Read-only access to campaigns and reports

### Permissions

- `view` - View campaigns and reports
- `edit` - Edit campaigns and settings
- `approve` - Approve pending changes
- `admin` - Manage team members and roles

### Key Components

#### PermissionsContext

Provides permission checking throughout the app:

```tsx
import { usePermissions } from '@/contexts/PermissionsContext';

function MyComponent() {
  const { currentUser, checks } = usePermissions();
  
  if (checks.canEdit()) {
    // Show edit button
  }
}
```

#### TeamManagement

Team management panel with:
- User list with role badges
- Search and filter capabilities
- Role assignment (for admins)
- Invite new users
- User statistics

#### RoleSelector

Dropdown component for role selection with:
- Visual role badges with colors
- Permission display
- Description of each role

#### InviteUser

Modal for inviting team members:
- Email validation
- Role selection
- Optional invitation message
- Form validation

### Usage Example

```tsx
import { TeamManagement } from '@/components/Team';

function Settings() {
  const [showTeam, setShowTeam] = useState(false);
  
  return (
    <>
      <button onClick={() => setShowTeam(true)}>
        Manage Team
      </button>
      
      <TeamManagement 
        isOpen={showTeam}
        onClose={() => setShowTeam(false)}
      />
    </>
  );
}
```

## Feature 2: Comments/Notes System

### Features

- Comment on campaigns, ad groups, keywords, and ads
- Threaded replies
- @mentions with autocomplete
- Edit and delete own comments
- Real-time timestamps
- Comment filtering (all/mentions)

### Key Components

#### CommentsPanel

Main panel for viewing and adding comments:
- Entity-specific comments
- Filter by mentions
- Add new comments
- View comment threads

#### CommentThread

Displays comment with replies:
- Author information
- Timestamp formatting (relative time)
- Reply functionality
- Edit/delete for own comments
- Collapsible replies
- @mention highlighting

#### CommentInput

Rich input component with:
- Auto-expanding textarea
- @mention autocomplete
- Character count
- Keyboard shortcuts (Cmd/Ctrl+Enter to submit)

### Usage Example

```tsx
import { CommentsPanel } from '@/components/Comments';

function CampaignDetail({ campaignId, campaignName }) {
  const [showComments, setShowComments] = useState(false);
  
  return (
    <>
      <button onClick={() => setShowComments(true)}>
        Comments
      </button>
      
      <CommentsPanel
        entityType="campaign"
        entityId={campaignId}
        entityName={campaignName}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
      />
    </>
  );
}
```

## Feature 3: Approval Workflows

### Features

- Request approval for high-impact changes
- Configurable approval thresholds
- Priority levels (low/medium/high)
- Approval queue for managers
- Approve/reject with comments
- Impact estimation
- Auto-prioritization

### Approval Types

- Budget increase/decrease
- Bid changes
- Status changes
- Campaign creation/deletion
- Bulk edits

### Approval Thresholds

Default thresholds (configurable):
- Budget increase > $500
- Budget decrease > $1000
- Campaign deletion (always requires approval)
- Bulk edits affecting > 10 entities

### Key Components

#### ApprovalsContext

Manages approval state:
- Create approval requests
- Review requests (approve/reject)
- Cancel requests
- Statistics tracking

#### ApprovalQueue

Main approval management panel:
- Pending requests counter
- Filter by status/type
- Search functionality
- Statistics dashboard
- Quick actions for managers

#### ApprovalRequest

Individual request card with:
- Status badges (pending/approved/rejected)
- Priority indicators
- Change details
- Impact estimation
- Review form
- Approve/reject buttons

#### RequestApproval

Modal for creating approval requests:
- Change type selection
- Entity information
- Change details
- Reason/justification
- Impact estimation
- Form validation

### Usage Example

```tsx
import { ApprovalQueue, RequestApproval } from '@/components/Approvals';
import { useApprovals } from '@/contexts/ApprovalsContext';

function BudgetEditor() {
  const { createApprovalRequest } = useApprovals();
  const [showRequest, setShowRequest] = useState(false);
  
  const handleBudgetChange = async (newBudget) => {
    // Check if approval is required
    if (needsApproval(newBudget)) {
      setShowRequest(true);
    } else {
      // Apply change directly
      await applyBudgetChange(newBudget);
    }
  };
  
  return (
    <>
      <button onClick={handleBudgetChange}>
        Change Budget
      </button>
      
      <RequestApproval
        isOpen={showRequest}
        onClose={() => setShowRequest(false)}
        onSubmit={createApprovalRequest}
        prefillData={{
          changeType: 'budget_increase',
          entityType: 'campaign',
          entityId: campaignId,
          entityName: campaignName,
        }}
      />
    </>
  );
}
```

## Integration Steps

### 1. Add Providers to App Layout

Update `src/app/layout.tsx` or `src/components/Providers.tsx`:

```tsx
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { ApprovalsProvider } from '@/contexts/ApprovalsContext';

export default function RootLayout({ children }) {
  return (
    <PermissionsProvider>
      <ApprovalsProvider>
        {children}
      </ApprovalsProvider>
    </PermissionsProvider>
  );
}
```

### 2. Add to Navigation

Update the sidebar navigation to include team and approvals:

```tsx
// In Sidebar.tsx
const navigationItems = [
  // ... existing items
  {
    name: 'Team',
    href: '/team',
    icon: <UsersIcon />,
  },
  {
    name: 'Approvals',
    href: '/approvals',
    icon: <CheckIcon />,
    badge: pendingCount > 0 ? pendingCount : undefined,
  },
];
```

### 3. Add Action Buttons

Add collaboration buttons to campaign/entity views:

```tsx
// In campaign detail view
<div className="flex gap-2">
  <button onClick={() => setShowComments(true)}>
    <ChatIcon /> Comments
  </button>
  
  <button onClick={() => setShowApprovals(true)}>
    <CheckIcon /> Request Approval
  </button>
</div>
```

## API Integration

The components use mock data for demonstration. To integrate with real APIs:

### 1. Team Management API

```typescript
// GET /api/team/members
// POST /api/team/invite
// PATCH /api/team/members/:id/role
// DELETE /api/team/members/:id
```

### 2. Comments API

```typescript
// GET /api/comments?entityType=campaign&entityId=123
// POST /api/comments
// PATCH /api/comments/:id
// DELETE /api/comments/:id
```

### 3. Approvals API

```typescript
// GET /api/approvals
// POST /api/approvals
// PATCH /api/approvals/:id/review
// DELETE /api/approvals/:id
```

## Styling

All components use Tailwind CSS classes matching the existing design system:

- Consistent color scheme (blue for primary actions)
- Responsive design (mobile-friendly)
- Dark mode support (via className patterns)
- Accessibility features (ARIA labels, keyboard navigation)

## Best Practices

### Permission Checks

Always check permissions before showing UI:

```tsx
const { checks } = usePermissions();

{checks.canApprove() && (
  <button>Approve Changes</button>
)}
```

### Loading States

All components handle loading states:

```tsx
{isLoading ? (
  <LoadingSpinner />
) : (
  <Content />
)}
```

### Error Handling

Components display user-friendly error messages:

```tsx
{error && (
  <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
    {error}
  </div>
)}
```

### Confirmation Dialogs

Destructive actions show confirmation:

```tsx
if (confirm('Are you sure you want to delete this comment?')) {
  await deleteComment(id);
}
```

## Future Enhancements

Potential improvements:

1. **Real-time Updates** - WebSocket support for live comments/approvals
2. **Email Notifications** - Alert users about mentions and approvals
3. **Audit Trail** - Full history of permission changes and approvals
4. **Advanced Mentions** - Tag teams, not just individuals
5. **File Attachments** - Add screenshots to comments
6. **Approval Templates** - Pre-configured approval workflows
7. **Mobile App** - Native mobile experience
8. **Analytics** - Track collaboration metrics

## Testing

Test the features:

1. **Permissions**: Try different roles and verify access control
2. **Comments**: Add comments, reply, edit, delete, use @mentions
3. **Approvals**: Create requests, review as manager, test thresholds

## Support

For questions or issues:
- Review component source code
- Check TypeScript types for data structures
- Refer to existing patterns in the codebase
