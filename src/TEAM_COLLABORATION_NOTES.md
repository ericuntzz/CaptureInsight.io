# Team Collaboration & Multi-User Functionality

## Overview
**CRITICAL IMPLEMENTATION REQUIREMENT**: The application must support multiple team members working collaboratively within the same account/workspace. This includes granular permissions for adding, editing, and deleting projects, files, folders, change logs, tags, and all other data entities.

---

## Core Requirements

### 1. Multi-Team Member Support

**User Roles & Hierarchy:**
```typescript
enum UserRole {
  OWNER = 'owner',           // Full access, can manage billing & team
  ADMIN = 'admin',           // Full access except billing
  EDITOR = 'editor',         // Can create, edit, delete own content
  VIEWER = 'viewer',         // Read-only access
  CONTRIBUTOR = 'contributor' // Can add content but not delete
}

interface TeamMember {
  id: UUID;
  user_id: UUID;
  account_id: UUID;
  role: UserRole;
  permissions: Permission[];
  invited_by: UUID;
  invited_at: Date;
  joined_at: Date | null;
  is_active: boolean;
  email: string;
  display_name: string;
  avatar_url?: string;
}
```

**Permission Granularity:**
```typescript
interface Permission {
  resource_type: 'project' | 'folder' | 'sheet' | 'changelog' | 'tag' | 'capture';
  action: 'create' | 'read' | 'update' | 'delete' | 'share';
  scope: 'own' | 'team' | 'all';  // Own items, team items, or all items
}

// Example permission sets
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: [
    { resource_type: '*', action: '*', scope: 'all' }  // Full access
  ],
  [UserRole.ADMIN]: [
    { resource_type: 'project', action: '*', scope: 'all' },
    { resource_type: 'folder', action: '*', scope: 'all' },
    { resource_type: 'sheet', action: '*', scope: 'all' },
    { resource_type: 'changelog', action: '*', scope: 'all' },
    { resource_type: 'tag', action: '*', scope: 'all' },
    { resource_type: 'capture', action: '*', scope: 'all' }
  ],
  [UserRole.EDITOR]: [
    { resource_type: 'project', action: 'read', scope: 'all' },
    { resource_type: 'project', action: 'create', scope: 'team' },
    { resource_type: 'folder', action: '*', scope: 'own' },
    { resource_type: 'sheet', action: '*', scope: 'own' },
    { resource_type: 'changelog', action: '*', scope: 'own' },
    { resource_type: 'tag', action: '*', scope: 'team' },
    { resource_type: 'capture', action: '*', scope: 'own' }
  ],
  [UserRole.CONTRIBUTOR]: [
    { resource_type: 'project', action: 'read', scope: 'all' },
    { resource_type: 'folder', action: 'read', scope: 'all' },
    { resource_type: 'folder', action: 'create', scope: 'team' },
    { resource_type: 'sheet', action: ['create', 'read', 'update'], scope: 'team' },
    { resource_type: 'changelog', action: ['create', 'read'], scope: 'team' },
    { resource_type: 'tag', action: ['create', 'read'], scope: 'team' },
    { resource_type: 'capture', action: ['create', 'read'], scope: 'team' }
  ],
  [UserRole.VIEWER]: [
    { resource_type: '*', action: 'read', scope: 'all' }
  ]
};
```

### 2. Team Member Invitation Flow

**Database Schema:**
```sql
-- Team invitations table
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  permissions JSONB,
  invited_by UUID NOT NULL REFERENCES users(id),
  invitation_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  declined_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_pending_invitation UNIQUE(account_id, email)
);

-- Team members table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  permissions JSONB,
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMP NOT NULL,
  joined_at TIMESTAMP,
  last_active_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_team_member UNIQUE(user_id, account_id)
);

CREATE INDEX idx_team_members_account ON team_members(account_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
```

**Invitation Workflow:**
```typescript
// 1. Owner/Admin sends invitation
async function inviteTeamMember(params: {
  accountId: UUID;
  invitedBy: UUID;
  email: string;
  role: UserRole;
  customPermissions?: Permission[];
}): Promise<TeamInvitation> {
  // Validate inviter has permission to invite
  const inviter = await getTeamMember(params.accountId, params.invitedBy);
  if (![UserRole.OWNER, UserRole.ADMIN].includes(inviter.role)) {
    throw new Error('Insufficient permissions to invite team members');
  }
  
  // Check if user already exists on team
  const existing = await db.query(
    'SELECT * FROM team_members WHERE account_id = $1 AND user_id = (SELECT id FROM users WHERE email = $2)',
    [params.accountId, params.email]
  );
  
  if (existing.rows.length > 0) {
    throw new Error('User is already a team member');
  }
  
  // Create invitation
  const token = generateSecureToken();
  const invitation = await db.insert('team_invitations', {
    account_id: params.accountId,
    email: params.email,
    role: params.role,
    permissions: params.customPermissions || ROLE_PERMISSIONS[params.role],
    invited_by: params.invitedBy,
    invitation_token: token,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  
  // Send invitation email
  await sendInvitationEmail({
    to: params.email,
    inviterName: inviter.display_name,
    accountName: (await getAccount(params.accountId)).name,
    invitationLink: `https://app.captureinsight.com/accept-invitation?token=${token}`,
    role: params.role
  });
  
  return invitation;
}

// 2. Invited user accepts invitation
async function acceptInvitation(token: string, userId: UUID): Promise<TeamMember> {
  const invitation = await db.query(
    'SELECT * FROM team_invitations WHERE invitation_token = $1 AND expires_at > NOW() AND accepted_at IS NULL',
    [token]
  );
  
  if (invitation.rows.length === 0) {
    throw new Error('Invalid or expired invitation');
  }
  
  const inv = invitation.rows[0];
  
  // Create team member record
  const teamMember = await db.insert('team_members', {
    user_id: userId,
    account_id: inv.account_id,
    role: inv.role,
    permissions: inv.permissions,
    invited_by: inv.invited_by,
    invited_at: inv.created_at,
    joined_at: new Date(),
    is_active: true
  });
  
  // Mark invitation as accepted
  await db.update('team_invitations', 
    { accepted_at: new Date() },
    { id: inv.id }
  );
  
  return teamMember;
}
```

### 3. Permission Checking System

**Authorization Middleware:**
```typescript
// Check if user has permission for an action
async function hasPermission(params: {
  userId: UUID;
  accountId: UUID;
  resourceType: string;
  action: string;
  resourceOwnerId?: UUID;  // For 'own' scope checks
}): Promise<boolean> {
  const member = await getTeamMember(params.accountId, params.userId);
  
  if (!member || !member.is_active) {
    return false;
  }
  
  // Owner has all permissions
  if (member.role === UserRole.OWNER) {
    return true;
  }
  
  // Check specific permissions
  const hasPermission = member.permissions.some(perm => {
    // Check resource type match (or wildcard)
    const resourceMatch = perm.resource_type === '*' || perm.resource_type === params.resourceType;
    
    // Check action match (or wildcard)
    const actionMatch = perm.action === '*' || 
                       (Array.isArray(perm.action) ? perm.action.includes(params.action) : perm.action === params.action);
    
    // Check scope
    let scopeMatch = false;
    switch (perm.scope) {
      case 'all':
        scopeMatch = true;
        break;
      case 'team':
        scopeMatch = true;  // User can access team resources
        break;
      case 'own':
        scopeMatch = params.resourceOwnerId === params.userId;
        break;
    }
    
    return resourceMatch && actionMatch && scopeMatch;
  });
  
  return hasPermission;
}

// Express middleware example
function requirePermission(resourceType: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.id;
    const accountId = req.params.accountId || req.user.current_account_id;
    const resourceOwnerId = req.body.owner_id || req.params.owner_id;
    
    const allowed = await hasPermission({
      userId,
      accountId,
      resourceType,
      action,
      resourceOwnerId
    });
    
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Usage in routes
app.post('/api/projects', 
  requirePermission('project', 'create'), 
  createProject
);

app.delete('/api/projects/:id', 
  requirePermission('project', 'delete'), 
  deleteProject
);
```

### 4. Change Logs with Team Member Attribution

**Enhanced Change Log Schema:**
```sql
CREATE TABLE change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),  -- Team member who created
  title VARCHAR(500) NOT NULL,
  description TEXT,
  log_date DATE NOT NULL,
  tags TEXT[],
  connected_assets JSONB,  -- Array of {type, id, name}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT chk_title_length CHECK (LENGTH(title) >= 3)
);

CREATE INDEX idx_changelogs_account ON change_logs(account_id);
CREATE INDEX idx_changelogs_project ON change_logs(project_id);
CREATE INDEX idx_changelogs_created_by ON change_logs(created_by);
CREATE INDEX idx_changelogs_date ON change_logs(log_date DESC);
CREATE INDEX idx_changelogs_tags ON change_logs USING GIN(tags);
```

**Change Log Queries with Team Member Filter:**
```typescript
async function getChangeLogs(params: {
  accountId: UUID;
  projectId?: UUID;
  folderId?: UUID;
  createdBy?: UUID;  // Filter by team member
  dateRange?: { start: Date; end: Date };
  tags?: string[];
  limit?: number;
  offset?: number;
}): Promise<ChangeLog[]> {
  let query = `
    SELECT 
      cl.*,
      u.email AS creator_email,
      u.display_name AS creator_name,
      u.avatar_url AS creator_avatar,
      tm.role AS creator_role
    FROM change_logs cl
    JOIN users u ON cl.created_by = u.id
    JOIN team_members tm ON tm.user_id = u.id AND tm.account_id = cl.account_id
    WHERE cl.account_id = $1
  `;
  
  const params_arr = [params.accountId];
  let paramIndex = 2;
  
  if (params.projectId) {
    query += ` AND cl.project_id = $${paramIndex++}`;
    params_arr.push(params.projectId);
  }
  
  if (params.folderId) {
    query += ` AND cl.folder_id = $${paramIndex++}`;
    params_arr.push(params.folderId);
  }
  
  if (params.createdBy) {
    query += ` AND cl.created_by = $${paramIndex++}`;
    params_arr.push(params.createdBy);
  }
  
  if (params.dateRange) {
    query += ` AND cl.log_date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
    params_arr.push(params.dateRange.start, params.dateRange.end);
  }
  
  if (params.tags && params.tags.length > 0) {
    query += ` AND cl.tags && $${paramIndex++}`;
    params_arr.push(params.tags);
  }
  
  query += ` ORDER BY cl.log_date DESC, cl.created_at DESC`;
  query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params_arr.push(params.limit || 50, params.offset || 0);
  
  const result = await db.query(query, params_arr);
  return result.rows;
}
```

### 5. Activity Tracking & Audit Logs

**Audit Log System:**
```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL,  -- 'create', 'update', 'delete', 'share'
  resource_type VARCHAR(50) NOT NULL,  -- 'project', 'folder', 'sheet', etc.
  resource_id UUID NOT NULL,
  resource_name VARCHAR(500),
  details JSONB,  -- Additional context (e.g., what changed)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_account ON activity_logs(account_id);
CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_resource ON activity_logs(resource_type, resource_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);

-- Partition by month for better performance
CREATE TABLE activity_logs_y2024m11 PARTITION OF activity_logs
FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
```

**Activity Tracking:**
```typescript
async function logActivity(params: {
  accountId: UUID;
  userId: UUID;
  action: string;
  resourceType: string;
  resourceId: UUID;
  resourceName: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  await db.insert('activity_logs', {
    account_id: params.accountId,
    user_id: params.userId,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    resource_name: params.resourceName,
    details: params.details,
    ip_address: params.ipAddress,
    user_agent: params.userAgent
  });
}

// Example usage
await logActivity({
  accountId: user.current_account_id,
  userId: user.id,
  action: 'create',
  resourceType: 'changelog',
  resourceId: newLog.id,
  resourceName: newLog.title,
  details: {
    project_id: newLog.project_id,
    tags: newLog.tags
  },
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});
```

### 6. Team Management UI Requirements

**Team Settings Page:**
- List all team members with role, join date, last active
- Ability to change member roles (if user has permission)
- Remove team members
- Resend invitations
- View pending invitations

**Activity Feed:**
- Real-time feed of team actions
- Filter by team member, action type, resource type
- Search through activity history
- Export activity logs

**Change Log Filters:**
- ✅ Filter by team member (implemented in frontend)
- Filter by date range
- Filter by project/folder
- Filter by tags

### 7. Real-Time Collaboration Features (Future Enhancement)

**WebSocket Integration:**
```typescript
// Notify team members when someone is viewing/editing a resource
interface CollaborationEvent {
  type: 'user_joined' | 'user_left' | 'user_editing' | 'resource_updated';
  userId: UUID;
  userName: string;
  resourceType: string;
  resourceId: UUID;
  timestamp: Date;
}

// Broadcast to team members in same account
function broadcastToTeam(accountId: UUID, event: CollaborationEvent) {
  io.to(`account:${accountId}`).emit('collaboration:event', event);
}
```

**Conflict Resolution:**
- Last-write-wins for simple fields
- Operational transformation for collaborative editing
- Version history with ability to view/restore previous versions

---

## Implementation Priority

**Phase 1 (MVP):**
- ✅ Basic user roles (Owner, Editor, Viewer)
- ✅ Team member invitations
- ✅ Permission checking on backend
- ✅ Change logs with team member attribution
- ✅ Activity logging for audit trail

**Phase 2 (Enhanced Collaboration):**
- Custom permission sets per team member
- Team activity feed in UI
- Bulk team member management
- Advanced change log filtering

**Phase 3 (Real-Time Collaboration):**
- Live presence indicators
- Concurrent editing
- Comments and mentions
- Notifications system

---

## Security Considerations

1. **Row-Level Security (RLS) in PostgreSQL:**
```sql
-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access data from accounts they're members of
CREATE POLICY account_member_policy ON projects
USING (
  account_id IN (
    SELECT account_id FROM team_members 
    WHERE user_id = current_setting('app.current_user_id')::uuid
    AND is_active = TRUE
  )
);
```

2. **API Rate Limiting per User:**
```typescript
// Prevent abuse from compromised accounts
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each user to 100 requests per windowMs
  keyGenerator: (req) => req.user.id
});
```

3. **2FA for Sensitive Actions:**
- Require 2FA for Owner role
- Require 2FA for deleting projects
- Require 2FA for removing team members

---

## Database Migration Script

```sql
-- Add team member tracking to all resource tables
ALTER TABLE projects ADD COLUMN created_by UUID REFERENCES users(id);
ALTER TABLE folders ADD COLUMN created_by UUID REFERENCES users(id);
ALTER TABLE sheets ADD COLUMN created_by UUID REFERENCES users(id);
ALTER TABLE captures ADD COLUMN created_by UUID REFERENCES users(id);

-- Add ownership audit columns
ALTER TABLE projects ADD COLUMN last_modified_by UUID REFERENCES users(id);
ALTER TABLE folders ADD COLUMN last_modified_by UUID REFERENCES users(id);
ALTER TABLE sheets ADD COLUMN last_modified_by UUID REFERENCES users(id);

-- Backfill existing data with account owner
UPDATE projects SET created_by = (
  SELECT user_id FROM team_members 
  WHERE account_id = projects.account_id 
  AND role = 'owner' 
  LIMIT 1
);

-- Create composite indexes for permission checks
CREATE INDEX idx_projects_account_owner ON projects(account_id, created_by);
CREATE INDEX idx_folders_account_owner ON folders(account_id, created_by);
CREATE INDEX idx_sheets_account_owner ON sheets(account_id, created_by);
```

---

This implementation provides enterprise-grade multi-user collaboration with granular permissions, audit logging, and scalable architecture for team-based workflows.
