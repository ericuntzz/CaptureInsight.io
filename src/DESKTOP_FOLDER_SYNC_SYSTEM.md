# Desktop Folder Sync System

**⚠️ CRITICAL FEATURE: Seamless desktop integration that eliminates manual uploading**

**NOTE FOR REPLIT:** This feature transforms CaptureInsight from a web-based tool to a native desktop experience. Users save files directly to local folders on their computer, and everything automatically syncs to their Spaces and Folders in the cloud. Think Dropbox/Google Drive, but specifically designed for analytics data with AI intelligence built in.

---

## The Core Problem: The "Save to Downloads" Habit

### Current User Behavior
Most people save files like this:
1. Download CSV from Google Ads → **Downloads folder**
2. Screenshot from HubSpot → **Desktop**
3. Excel report → **Desktop** or **Documents**
4. Then manually upload to various tools
5. Files scattered everywhere, no organization
6. Lose track of what's where
7. No automatic backup or sync

**Result:** Digital clutter, lost files, manual work, no centralization.

### What Users Actually Want
- Save once, available everywhere
- Automatic organization (not manual uploading)
- Files tied to specific projects/contexts
- No switching between desktop and web
- Native OS experience (feels natural, not clunky)
- Confidence their data is backed up

---

## The Solution: CaptureInsight Desktop Folders

### How It Works

#### 1. **One-Time Setup**
User installs CaptureInsight desktop app and selects where to create their sync folder:
- Default: `~/CaptureInsight/` on macOS or `C:\Users\[Name]\CaptureInsight\` on Windows
- Custom: User can choose any location

#### 2. **Folder Structure Mirrors Spaces**
The desktop folder automatically reflects the user's Spaces and Folders:

```
📁 CaptureInsight/
├── 📁 Q4 2024 Ad Campaigns/          ← Space
│   ├── 📁 Google Ads/                ← Folder
│   │   ├── weekly-performance.csv
│   │   ├── campaign-screenshot.png
│   │   └── conversion-data.xlsx
│   ├── 📁 Facebook Ads/              ← Folder
│   │   ├── audience-insights.csv
│   │   └── ad-creative-performance.png
│   └── 📁 Analytics Reports/         ← Folder
│       └── ga4-funnel-data.csv
├── 📁 Sales Pipeline 2024/           ← Space
│   ├── 📁 Lead Generation/           ← Folder
│   └── 📁 Deal Analysis/             ← Folder
└── 📁 Product Metrics/               ← Space
    └── 📁 User Engagement/           ← Folder
```

#### 3. **Save Directly from Any Application**
User works naturally:
- Export CSV from Google Ads → **File > Save As > CaptureInsight/Q4 2024 Ad Campaigns/Google Ads/**
- Screenshot (Cmd+Shift+4 on Mac) → **Drag into CaptureInsight/Q4 2024 Ad Campaigns/Google Ads/**
- Excel report → **Save to CaptureInsight/Product Metrics/User Engagement/**

**The file is now automatically:**
- ✅ Uploaded to cloud
- ✅ Added to correct Space and Folder
- ✅ Processed by OCR/AI (if image)
- ✅ Parsed into structured data (if CSV/Excel)
- ✅ Embedded into vector database
- ✅ Searchable by AI Assistant
- ✅ Backed up

#### 4. **Two-Way Sync**
Changes sync bidirectionally:
- **Desktop → Cloud:** Save file locally, it appears in web app
- **Cloud → Desktop:** Upload via web app, it appears in desktop folder
- **Multi-device:** Work on MacBook, files sync to Windows desktop
- **Team collaboration:** Share Space, teammates see files in their desktop folders

#### 5. **Real-Time Updates**
- File watcher detects changes instantly
- Sync happens in background (no "sync now" button)
- Status indicator shows sync progress
- Conflicts handled intelligently

---

## Technical Architecture

### System Components

```typescript
// Desktop App Components
interface DesktopSyncSystem {
  fileWatcher: FileSystemWatcher;      // Monitors local folder changes
  syncEngine: SyncEngine;              // Handles bidirectional sync
  conflictResolver: ConflictResolver;  // Resolves sync conflicts
  uploadQueue: UploadQueue;            // Manages background uploads
  indexer: LocalIndexer;               // Indexes local files for fast search
  apiClient: CloudAPIClient;           // Communicates with cloud
}
```

### File System Watcher

```typescript
import chokidar from 'chokidar';
import { EventEmitter } from 'events';

class FileSystemWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher;
  private syncRootPath: string;
  
  constructor(syncRootPath: string) {
    super();
    this.syncRootPath = syncRootPath;
    this.initWatcher();
  }
  
  private initWatcher() {
    this.watcher = chokidar.watch(this.syncRootPath, {
      persistent: true,
      ignoreInitial: false,
      ignored: [
        // Ignore system files
        '**/.DS_Store',
        '**/Thumbs.db',
        '**/*.tmp',
        '**/.captureinsight/**', // Internal metadata folder
      ],
      awaitWriteFinish: {
        stabilityThreshold: 2000, // Wait 2s after last change
        pollInterval: 100
      }
    });
    
    // File added
    this.watcher.on('add', (path: string) => {
      this.handleFileAdded(path);
    });
    
    // File changed
    this.watcher.on('change', (path: string) => {
      this.handleFileChanged(path);
    });
    
    // File deleted
    this.watcher.on('unlink', (path: string) => {
      this.handleFileDeleted(path);
    });
    
    // Directory added
    this.watcher.on('addDir', (path: string) => {
      this.handleDirectoryAdded(path);
    });
    
    // Directory deleted
    this.watcher.on('unlinkDir', (path: string) => {
      this.handleDirectoryDeleted(path);
    });
  }
  
  private async handleFileAdded(filePath: string) {
    console.log(`File added: ${filePath}`);
    
    // Parse the path to determine Space and Folder
    const { spaceId, folderId } = this.parsePathToSpaceFolder(filePath);
    
    // Add to upload queue
    await uploadQueue.enqueue({
      type: 'file_add',
      localPath: filePath,
      spaceId,
      folderId,
      timestamp: Date.now()
    });
  }
  
  private async handleFileChanged(filePath: string) {
    console.log(`File changed: ${filePath}`);
    
    // Check if this is a local change or remote change (to prevent loops)
    const changeOrigin = await this.detectChangeOrigin(filePath);
    
    if (changeOrigin === 'local') {
      // Upload the updated file
      await uploadQueue.enqueue({
        type: 'file_update',
        localPath: filePath,
        timestamp: Date.now()
      });
    }
  }
  
  private async handleFileDeleted(filePath: string) {
    console.log(`File deleted: ${filePath}`);
    
    // Check if user deleted or sync deleted
    const changeOrigin = await this.detectChangeOrigin(filePath);
    
    if (changeOrigin === 'local') {
      // Delete from cloud
      await uploadQueue.enqueue({
        type: 'file_delete',
        localPath: filePath,
        timestamp: Date.now()
      });
    }
  }
  
  private parsePathToSpaceFolder(filePath: string): { spaceId: UUID, folderId: UUID } {
    // Example: /Users/john/CaptureInsight/Q4 2024 Ad Campaigns/Google Ads/report.csv
    // Extract: Space = "Q4 2024 Ad Campaigns", Folder = "Google Ads"
    
    const relativePath = filePath.replace(this.syncRootPath, '');
    const pathParts = relativePath.split('/').filter(p => p);
    
    const spaceName = pathParts[0]; // "Q4 2024 Ad Campaigns"
    const folderName = pathParts[1]; // "Google Ads"
    
    // Look up Space and Folder IDs from local cache
    const spaceId = localCache.getSpaceIdByName(spaceName);
    const folderId = localCache.getFolderIdByName(spaceId, folderName);
    
    return { spaceId, folderId };
  }
  
  private async detectChangeOrigin(filePath: string): Promise<'local' | 'remote'> {
    // Check metadata to see if this change came from sync or user
    const metadata = await localMetadataDB.getFileMetadata(filePath);
    const currentHash = await calculateFileHash(filePath);
    
    if (metadata && metadata.lastSyncHash === currentHash) {
      return 'remote'; // This was a sync operation
    }
    
    return 'local'; // This was a user change
  }
}
```

### Sync Engine

```typescript
class SyncEngine {
  private uploadQueue: UploadQueue;
  private downloadQueue: DownloadQueue;
  private conflictResolver: ConflictResolver;
  
  async syncFile(operation: SyncOperation): Promise<void> {
    try {
      switch (operation.type) {
        case 'file_add':
          await this.uploadNewFile(operation);
          break;
        case 'file_update':
          await this.uploadUpdatedFile(operation);
          break;
        case 'file_delete':
          await this.deleteCloudFile(operation);
          break;
      }
    } catch (error) {
      console.error('Sync error:', error);
      await this.handleSyncError(operation, error);
    }
  }
  
  private async uploadNewFile(operation: SyncOperation): Promise<void> {
    const { localPath, spaceId, folderId } = operation;
    
    // 1. Calculate file hash (for deduplication and conflict detection)
    const fileHash = await calculateFileHash(localPath);
    
    // 2. Check if file already exists in cloud
    const existingFile = await api.checkFileExists(spaceId, folderId, fileHash);
    
    if (existingFile) {
      console.log('File already exists in cloud, skipping upload');
      await this.updateLocalMetadata(localPath, existingFile);
      return;
    }
    
    // 3. Read file
    const fileBuffer = await fs.readFile(localPath);
    const fileName = path.basename(localPath);
    const fileExtension = path.extname(localPath);
    const fileSizeBytes = fileBuffer.length;
    
    // 4. Upload to cloud storage
    const uploadUrl = await api.getUploadUrl(spaceId, folderId, fileName);
    const cloudFileUrl = await uploadToStorage(uploadUrl, fileBuffer);
    
    // 5. Create Sheet record in database
    const sheet = await api.createSheet({
      space_id: spaceId,
      folder_id: folderId,
      name: fileName.replace(fileExtension, ''), // Remove extension
      file_type: fileExtension.replace('.', ''),
      file_url: cloudFileUrl,
      file_size_bytes: fileSizeBytes,
      file_hash: fileHash,
      source: 'desktop_sync'
    });
    
    // 6. Update local metadata
    await this.updateLocalMetadata(localPath, {
      sheetId: sheet.id,
      lastSyncHash: fileHash,
      lastSyncTime: Date.now()
    });
    
    // 7. Trigger processing (OCR, parsing, embedding)
    await api.triggerFileProcessing(sheet.id);
    
    console.log(`✅ File uploaded: ${fileName}`);
  }
  
  private async uploadUpdatedFile(operation: SyncOperation): Promise<void> {
    const { localPath } = operation;
    
    // Get existing sheet ID from local metadata
    const metadata = await localMetadataDB.getFileMetadata(localPath);
    
    if (!metadata || !metadata.sheetId) {
      // File doesn't exist in cloud yet, treat as new file
      return this.uploadNewFile(operation);
    }
    
    // Calculate new hash
    const newHash = await calculateFileHash(localPath);
    
    // Check for conflicts (cloud version changed since last sync)
    const cloudSheet = await api.getSheet(metadata.sheetId);
    
    if (cloudSheet.file_hash !== metadata.lastSyncHash) {
      // Conflict detected! Cloud version changed too
      await this.conflictResolver.resolveConflict({
        localPath,
        localHash: newHash,
        cloudSheet,
        lastSyncHash: metadata.lastSyncHash
      });
      return;
    }
    
    // No conflict, safe to upload
    const fileBuffer = await fs.readFile(localPath);
    const uploadUrl = await api.getUploadUrl(cloudSheet.space_id, cloudSheet.folder_id, path.basename(localPath));
    const cloudFileUrl = await uploadToStorage(uploadUrl, fileBuffer);
    
    // Update sheet record
    await api.updateSheet(metadata.sheetId, {
      file_url: cloudFileUrl,
      file_hash: newHash,
      file_size_bytes: fileBuffer.length,
      updated_at: new Date()
    });
    
    // Update local metadata
    await this.updateLocalMetadata(localPath, {
      lastSyncHash: newHash,
      lastSyncTime: Date.now()
    });
    
    // Trigger reprocessing
    await api.triggerFileProcessing(metadata.sheetId);
    
    console.log(`✅ File updated: ${path.basename(localPath)}`);
  }
  
  private async deleteCloudFile(operation: SyncOperation): Promise<void> {
    const { localPath } = operation;
    
    // Get sheet ID from local metadata
    const metadata = await localMetadataDB.getFileMetadata(localPath);
    
    if (!metadata || !metadata.sheetId) {
      console.log('File not found in cloud, nothing to delete');
      return;
    }
    
    // Soft delete (move to trash, not permanent delete)
    await api.deleteSheet(metadata.sheetId);
    
    // Remove local metadata
    await localMetadataDB.deleteFileMetadata(localPath);
    
    console.log(`✅ File deleted from cloud: ${path.basename(localPath)}`);
  }
}
```

### Conflict Resolution

```typescript
interface ConflictResolution {
  strategy: 'keep_local' | 'keep_cloud' | 'keep_both' | 'manual';
  newFileName?: string; // If 'keep_both'
}

class ConflictResolver {
  async resolveConflict(conflict: FileConflict): Promise<ConflictResolution> {
    const { localPath, localHash, cloudSheet, lastSyncHash } = conflict;
    
    // Show conflict dialog to user
    const resolution = await this.showConflictDialog({
      fileName: path.basename(localPath),
      localModifiedTime: await getFileModifiedTime(localPath),
      cloudModifiedTime: cloudSheet.updated_at,
      localSize: await getFileSize(localPath),
      cloudSize: cloudSheet.file_size_bytes
    });
    
    switch (resolution.strategy) {
      case 'keep_local':
        // Upload local version, overwrite cloud
        await this.overwriteCloudVersion(localPath, cloudSheet);
        break;
        
      case 'keep_cloud':
        // Download cloud version, overwrite local
        await this.overwriteLocalVersion(localPath, cloudSheet);
        break;
        
      case 'keep_both':
        // Rename local file and upload as new
        const newFileName = this.generateConflictFileName(localPath);
        await fs.rename(localPath, newFileName);
        await this.uploadNewFile({ localPath: newFileName, ...conflict });
        break;
        
      case 'manual':
        // User will resolve manually
        await this.markAsConflicted(localPath, cloudSheet);
        break;
    }
    
    return resolution;
  }
  
  private generateConflictFileName(originalPath: string): string {
    // Example: report.csv → report (conflict 2024-01-15 14:30).csv
    const dir = path.dirname(originalPath);
    const ext = path.extname(originalPath);
    const baseName = path.basename(originalPath, ext);
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    
    return path.join(dir, `${baseName} (conflict ${timestamp})${ext}`);
  }
  
  private async showConflictDialog(conflictInfo: ConflictInfo): Promise<ConflictResolution> {
    // Show native OS dialog
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Sync Conflict',
      message: `"${conflictInfo.fileName}" has been modified in both locations`,
      detail: `
Local file: Modified ${conflictInfo.localModifiedTime}, ${formatBytes(conflictInfo.localSize)}
Cloud file: Modified ${conflictInfo.cloudModifiedTime}, ${formatBytes(conflictInfo.cloudSize)}

What would you like to do?
      `,
      buttons: [
        'Keep Local Version',
        'Keep Cloud Version',
        'Keep Both',
        'Resolve Manually Later'
      ],
      defaultId: 2 // Default to "Keep Both" (safest option)
    });
    
    const strategies: ConflictResolution['strategy'][] = [
      'keep_local',
      'keep_cloud',
      'keep_both',
      'manual'
    ];
    
    return { strategy: strategies[result.response] };
  }
}
```

### Upload Queue (Background Processing)

```typescript
class UploadQueue {
  private queue: SyncOperation[] = [];
  private processing: boolean = false;
  private maxConcurrent: number = 3;
  
  async enqueue(operation: SyncOperation): Promise<void> {
    this.queue.push(operation);
    
    if (!this.processing) {
      this.processQueue();
    }
  }
  
  private async processQueue(): Promise<void> {
    this.processing = true;
    
    while (this.queue.length > 0) {
      // Process up to maxConcurrent operations in parallel
      const batch = this.queue.splice(0, this.maxConcurrent);
      
      await Promise.all(
        batch.map(op => syncEngine.syncFile(op))
      );
      
      // Update sync status in UI
      this.updateSyncStatus();
    }
    
    this.processing = false;
  }
  
  private updateSyncStatus(): void {
    const remaining = this.queue.length;
    
    // Update system tray icon
    if (remaining > 0) {
      tray.setIcon(syncingIcon);
      tray.setToolTip(`Syncing ${remaining} file(s)...`);
    } else {
      tray.setIcon(syncedIcon);
      tray.setToolTip('All files synced');
    }
  }
}
```

---

## Database Schema Extensions

### Sync Metadata Table

```sql
-- Track sync state for each file
CREATE TABLE sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID REFERENCES sheets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- File identification
  file_path TEXT NOT NULL, -- Relative path within sync folder
  file_hash VARCHAR(64) NOT NULL, -- SHA-256 hash
  
  -- Sync tracking
  last_synced_at TIMESTAMP DEFAULT NOW(),
  sync_status VARCHAR(50) DEFAULT 'synced', -- 'synced', 'syncing', 'conflict', 'error'
  
  -- Device tracking (for multi-device sync)
  device_id UUID REFERENCES devices(id),
  
  -- Conflict resolution
  conflict_detected_at TIMESTAMP,
  conflict_resolved_at TIMESTAMP,
  conflict_resolution VARCHAR(50), -- 'keep_local', 'keep_cloud', 'keep_both', 'manual'
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, file_path, device_id)
);

-- Track user devices for multi-device sync
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  device_name VARCHAR(255) NOT NULL, -- e.g., "John's MacBook Pro"
  device_type VARCHAR(50) NOT NULL, -- 'macos', 'windows', 'linux'
  device_identifier VARCHAR(255) UNIQUE NOT NULL, -- Unique hardware ID
  
  sync_root_path TEXT, -- Where sync folder is located on this device
  
  last_active_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, device_identifier)
);

-- Extend sheets table to track sync origin
ALTER TABLE sheets ADD COLUMN source VARCHAR(50) DEFAULT 'web_upload';
-- Values: 'web_upload', 'desktop_sync', 'api', 'screenshot_capture'

-- Indexes
CREATE INDEX idx_sync_metadata_user ON sync_metadata(user_id);
CREATE INDEX idx_sync_metadata_sheet ON sync_metadata(sheet_id);
CREATE INDEX idx_sync_metadata_status ON sync_metadata(sync_status);
CREATE INDEX idx_devices_user ON devices(user_id);
```

### Local Metadata Database (SQLite on Desktop)

```sql
-- Local SQLite database on user's computer
-- Stores metadata about synced files for fast lookups

CREATE TABLE local_file_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- File identification
  local_path TEXT NOT NULL UNIQUE,
  file_hash TEXT NOT NULL,
  
  -- Cloud mapping
  sheet_id TEXT NOT NULL, -- UUID from cloud
  space_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  
  -- Sync state
  last_sync_hash TEXT, -- Hash when last synced
  last_sync_time INTEGER, -- Unix timestamp
  sync_status TEXT DEFAULT 'synced',
  
  -- File metadata
  file_size_bytes INTEGER,
  modified_time INTEGER,
  
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Space/Folder cache (for fast path lookups)
CREATE TABLE local_space_cache (
  space_id TEXT PRIMARY KEY,
  space_name TEXT NOT NULL,
  folder_path TEXT NOT NULL, -- e.g., "Q4 2024 Ad Campaigns"
  last_updated INTEGER
);

CREATE TABLE local_folder_cache (
  folder_id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  folder_name TEXT NOT NULL,
  folder_path TEXT NOT NULL, -- e.g., "Q4 2024 Ad Campaigns/Google Ads"
  last_updated INTEGER
);

-- Indexes
CREATE INDEX idx_local_file_sheet ON local_file_metadata(sheet_id);
CREATE INDEX idx_local_file_hash ON local_file_metadata(file_hash);
CREATE INDEX idx_local_space_name ON local_space_cache(space_name);
```

---

## UI/UX Implementation

### 1. Initial Setup Flow

**Step 1: Choose Sync Location**
```tsx
function SyncSetupDialog() {
  const [syncPath, setSyncPath] = useState(getDefaultSyncPath());
  
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Up Desktop Sync</DialogTitle>
          <DialogDescription>
            Choose where to create your CaptureInsight sync folder
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input value={syncPath} readOnly />
            <Button onClick={chooseSyncPath}>Browse</Button>
          </div>
          
          <Alert>
            <InfoIcon className="size-4" />
            <AlertDescription>
              All your Spaces and Folders will sync to this location. 
              Files saved here will automatically upload to CaptureInsight.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <h4 className="font-medium">Folder Preview:</h4>
            <code className="block p-2 bg-gray-100 rounded text-sm">
              {syncPath}/CaptureInsight/
              ├── Space 1/
              ├── Space 2/
              └── Space 3/
            </code>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={setupSync}>Create Sync Folder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Initial Sync**
```tsx
function InitialSyncProgress() {
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setting Up Your Sync Folder</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Progress value={(progress.current / progress.total) * 100} />
          <p className="text-sm text-gray-600">
            Creating folder structure... {progress.current} of {progress.total} folders
          </p>
          <Alert>
            <InfoIcon className="size-4" />
            <AlertDescription>
              This is a one-time setup. Once complete, all your files will stay in sync automatically.
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 2. System Tray Icon (Always Visible)

```tsx
interface SyncStatusIndicator {
  icon: SyncIcon;
  tooltip: string;
  menu: TrayMenu;
}

enum SyncIcon {
  Synced = '✓',      // Green checkmark - everything up to date
  Syncing = '↻',     // Blue rotating - actively syncing
  Paused = '⏸',      // Gray pause - sync paused
  Error = '⚠',       // Red warning - sync error
  Conflict = '⚡'    // Yellow lightning - conflict detected
}

const trayMenu: TrayMenu = {
  items: [
    { label: 'Open CaptureInsight Folder', action: openSyncFolder },
    { label: 'Recent Files', submenu: recentFiles },
    { separator: true },
    { label: 'Sync Status: All files synced', disabled: true },
    { label: 'Pause Syncing', action: pauseSync },
    { separator: true },
    { label: 'Preferences', action: openPreferences },
    { label: 'Quit CaptureInsight', action: quit }
  ]
};
```

### 3. Sync Status in Web App

```tsx
function SyncStatusBanner() {
  const { devices, activeSyncs } = useSyncStatus();
  
  return (
    <Alert className="mb-4">
      <LaptopIcon className="size-4" />
      <AlertTitle>Desktop Sync Active</AlertTitle>
      <AlertDescription>
        <div className="flex items-center gap-4">
          <span>
            {devices.length} device{devices.length !== 1 ? 's' : ''} connected
          </span>
          {activeSyncs > 0 && (
            <span className="flex items-center gap-1">
              <Spinner className="size-3" />
              Syncing {activeSyncs} file{activeSyncs !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button variant="link" onClick={viewDevices} className="p-0 h-auto">
          Manage devices →
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

### 4. Device Management

```tsx
function DeviceManagementPanel() {
  const { devices } = useDevices();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Devices</CardTitle>
        <CardDescription>
          Devices with desktop sync enabled
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Sync Location</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map(device => (
              <TableRow key={device.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {device.device_type === 'macos' ? <AppleIcon /> : <WindowsIcon />}
                    {device.device_name}
                    {device.is_current && <Badge>This device</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-xs">{device.sync_root_path}</code>
                </TableCell>
                <TableCell>
                  {formatDistanceToNow(device.last_active_at)} ago
                </TableCell>
                <TableCell>
                  {device.is_active ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuItem onClick={() => openSyncFolder(device)}>
                      Open Folder
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => renameDevice(device)}>
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => unlinkDevice(device)}
                      className="text-red-600"
                    >
                      Unlink Device
                    </DropdownMenuItem>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

### 5. Conflict Resolution Dialog

```tsx
function ConflictResolutionDialog({ conflict }: { conflict: FileConflict }) {
  return (
    <Dialog open>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sync Conflict Detected</DialogTitle>
          <DialogDescription>
            "{conflict.fileName}" was modified in two places
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Local Version */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Local Version</CardTitle>
              <CardDescription>On this computer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm text-gray-600">Modified:</span>
                <p>{formatDateTime(conflict.localModifiedTime)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Size:</span>
                <p>{formatBytes(conflict.localSize)}</p>
              </div>
            </CardContent>
          </Card>
          
          {/* Cloud Version */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cloud Version</CardTitle>
              <CardDescription>In CaptureInsight</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm text-gray-600">Modified:</span>
                <p>{formatDateTime(conflict.cloudModifiedTime)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Size:</span>
                <p>{formatBytes(conflict.cloudSize)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Alert>
          <InfoIcon className="size-4" />
          <AlertDescription>
            Choose which version to keep, or keep both as separate files
          </AlertDescription>
        </Alert>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => resolveConflict('manual')}>
            Resolve Later
          </Button>
          <Button variant="outline" onClick={() => resolveConflict('keep_cloud')}>
            Keep Cloud Version
          </Button>
          <Button variant="outline" onClick={() => resolveConflict('keep_local')}>
            Keep Local Version
          </Button>
          <Button onClick={() => resolveConflict('keep_both')}>
            Keep Both (Recommended)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Key Features & Capabilities

### 1. **Automatic Folder Structure Creation**
When user creates a new Space or Folder in web app:
- Desktop folder structure updates automatically
- New folders appear in sync folder instantly
- No manual "create folder" on desktop needed

### 2. **Selective Sync (Advanced)**
For users with many Spaces:
```tsx
function SelectiveSyncSettings() {
  const { spaces } = useSpaces();
  const [syncedSpaces, setSyncedSpaces] = useState<UUID[]>([]);
  
  return (
    <div>
      <h3>Choose which Spaces to sync</h3>
      {spaces.map(space => (
        <Checkbox
          key={space.id}
          label={space.name}
          checked={syncedSpaces.includes(space.id)}
          onChange={(checked) => toggleSpaceSync(space.id, checked)}
        />
      ))}
    </div>
  );
}
```

### 3. **Bandwidth Management**
```typescript
interface SyncPreferences {
  uploadSpeed: 'unlimited' | 'limited';
  uploadSpeedKBps: number; // If limited
  
  downloadSpeed: 'unlimited' | 'limited';
  downloadSpeedKBps: number;
  
  pauseOnMeteredConnection: boolean;
  pauseOnBattery: boolean;
  
  syncSchedule: {
    enabled: boolean;
    startTime: string; // e.g., "09:00"
    endTime: string;   // e.g., "17:00"
  };
}
```

### 4. **File Type Filtering**
```typescript
interface FileTypeFilter {
  includedExtensions: string[]; // ['.csv', '.xlsx', '.png', '.jpg']
  excludedExtensions: string[]; // ['.exe', '.dmg']
  maxFileSizeMB: number; // e.g., 100 MB
}
```

### 5. **Version History**
- Desktop sync preserves file versions
- User can restore previous versions from web app
- Automatic versioning on every sync

### 6. **Offline Mode**
- Works offline (queues uploads)
- Shows "offline" indicator
- Syncs when connection restored
- No data loss

---

## Security & Privacy

### File Encryption
```typescript
// Files encrypted before upload
async function encryptFile(filePath: string, encryptionKey: string): Promise<Buffer> {
  const fileBuffer = await fs.readFile(filePath);
  const encrypted = crypto.encrypt(fileBuffer, encryptionKey);
  return encrypted;
}

// Files decrypted after download
async function decryptFile(encryptedBuffer: Buffer, encryptionKey: string): Promise<Buffer> {
  const decrypted = crypto.decrypt(encryptedBuffer, encryptionKey);
  return decrypted;
}
```

### Access Control
- Only user's own files accessible
- Team-shared Spaces sync only if permissions granted
- Audit log of all sync operations

### Data Privacy
- Files never leave user's control (local + cloud backup)
- Can enable "local only" mode (no cloud sync)
- GDPR/CCPA compliant

---

## Performance Optimization

### Delta Sync (Only Upload Changed Blocks)
```typescript
// For large files, only upload changed blocks
async function deltaSync(filePath: string, previousHash: string): Promise<void> {
  const currentBlocks = await splitFileIntoBlocks(filePath);
  const previousBlocks = await getBlockHashesFromCloud(previousHash);
  
  const changedBlocks = currentBlocks.filter(
    (block, index) => block.hash !== previousBlocks[index]?.hash
  );
  
  // Only upload changed blocks
  for (const block of changedBlocks) {
    await uploadBlock(block);
  }
  
  // Reconstruct file on server
  await api.reconstructFile(filePath, currentBlocks);
}
```

### Deduplication
```typescript
// If file already exists (same hash), don't upload
async function checkDuplication(fileHash: string): Promise<boolean> {
  const existingFile = await api.findFileByHash(fileHash);
  if (existingFile) {
    // Just link to existing file, don't upload again
    await api.linkExistingFile(existingFile.id);
    return true;
  }
  return false;
}
```

### Background Processing
- Sync happens in background (doesn't block UI)
- Prioritize small files first
- Batch operations for efficiency

---

## Implementation Checklist

### Phase 1: Core Sync (Weeks 1-3)
- [ ] File system watcher setup (chokidar)
- [ ] Upload queue implementation
- [ ] Download queue implementation
- [ ] Basic sync engine (add/update/delete)
- [ ] Local metadata database (SQLite)
- [ ] Cloud API client

### Phase 2: Folder Structure (Week 4)
- [ ] Space/Folder path mapping
- [ ] Automatic folder creation
- [ ] Folder rename handling
- [ ] Folder delete handling

### Phase 3: Conflict Resolution (Week 5)
- [ ] Conflict detection algorithm
- [ ] Conflict resolution UI
- [ ] "Keep both" file naming
- [ ] Manual conflict queue

### Phase 4: Multi-Device Sync (Week 6)
- [ ] Device registration
- [ ] Device management UI
- [ ] Multi-device conflict resolution
- [ ] Device activity tracking

### Phase 5: Advanced Features (Week 7-8)
- [ ] Selective sync
- [ ] Bandwidth management
- [ ] File type filtering
- [ ] Offline mode support

### Phase 6: Performance & Security (Week 9-10)
- [ ] Delta sync implementation
- [ ] Deduplication
- [ ] File encryption
- [ ] Performance testing

---

## Success Metrics

**Adoption:**
- 70%+ of users enable desktop sync within first week
- 80%+ of files come from desktop sync (vs. manual upload)
- 50%+ of users access files via desktop folder daily

**Reliability:**
- 99.9% uptime for sync service
- <1% conflict rate
- <5 second sync latency for new files

**Performance:**
- 10MB file syncs in <30 seconds
- 100MB file syncs in <3 minutes
- No noticeable system performance impact

**User Satisfaction:**
- 90%+ report "sync just works"
- 85%+ prefer desktop sync over manual upload
- <2% need support for sync issues

---

## Technical Requirements for Replit

### Desktop App Framework
**Recommendation:** Electron or Tauri

**Electron Pros:**
- ✅ Mature ecosystem
- ✅ Rich file system APIs
- ✅ Easy to integrate with existing web UI
- ✅ Cross-platform (macOS, Windows, Linux)

**Tauri Pros:**
- ✅ Lighter weight (smaller app size)
- ✅ Better performance
- ✅ More secure (Rust backend)
- ❌ Newer, smaller ecosystem

**Decision Needed:** Electron (recommended for faster development) or Tauri (recommended for better performance)

### File Watching Library
**Recommendation:** chokidar (Node.js)
- ✅ Battle-tested
- ✅ Cross-platform
- ✅ Handles edge cases well
- ✅ Good performance

### Local Database
**Recommendation:** SQLite (via better-sqlite3)
- ✅ Fast local queries
- ✅ No separate database service
- ✅ Embedded in app

### Cloud Storage
**Recommendation:** Use existing storage solution (AWS S3, Cloudflare R2, or Supabase Storage)
- Connect to same storage as web uploads

---

**Last Updated:** January 2025  
**For:** CaptureInsight Production Implementation  
**Audience:** Replit AI Agent  
**Priority:** High - Core Feature
