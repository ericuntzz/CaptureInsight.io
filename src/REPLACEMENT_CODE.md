# 🔧 EXACT REPLACEMENT CODE FOR ProjectBrowser.tsx

## Location
File: `/components/ProjectBrowser.tsx`  
Lines to Replace: Approximately 404-748 (from `{/* Project List */}` to `{/* Spacer when collapsed */}`)

---

## FIND THIS CODE:

```tsx
      {/* Project List */}
      {!isCollapsed && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto px-2 py-[-3px] bg-[rgba(10,14,26,0)]"
        >
          {/* Spaces Header */}
          <div className="px-[12px] py-[17px]">
            <AnimatePresence>
              <motion.h2 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-[#9CA3AF] text-[20px] whitespace-nowrap overflow-hidden"
              >
                Spaces
              </motion.h2>
            </AnimatePresence>
          </div>

          {projects.map((project) => {
            // ... ENTIRE PROJECT MAP SECTION ...
          })}
        </motion.div>
      )}
```

---

## REPLACE WITH THIS CODE:

```tsx
      {/* Folder List - Space-Scoped */}
      {!isCollapsed && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto px-2 py-[-3px] bg-[rgba(10,14,26,0)]"
        >
          {/* Folders Header */}
          <div className="px-[12px] py-[17px]">
            <AnimatePresence>
              <motion.h2 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-[#9CA3AF] text-[20px] whitespace-nowrap overflow-hidden"
              >
                Folders
              </motion.h2>
            </AnimatePresence>
          </div>

          {/* ⚠️ CRITICAL: Space-scoped folder display - only show folders from current Space */}
          {currentSpace ? (
            <>
              {foldersToDisplay.map((folder) => {
                const isFolderExpanded = expandedFolders.has(folder.id);
                
                return (
                  <div key={folder.id} className="mb-2">
                    {/* Folder Header */}
                    <div className="w-full flex items-center gap-2 px-2 py-2 hover:bg-[rgba(255,107,53,0.05)] rounded-lg transition-colors group">
                      {editingFolder?.folderId === folder.id ? (
                        // Editing mode - inline input
                        <div className="flex-1 flex items-center gap-2">
                          <div className="w-4 h-4" /> {/* Spacer for alignment */}
                          <input
                            ref={inputRef}
                            type="text"
                            value={editingFolder.name}
                            onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEditFolder();
                              } else if (e.key === 'Escape') {
                                handleCancelEditFolder();
                              }
                            }}
                            className="flex-1 bg-[#0A0E1A] border border-[#FF6B35] rounded px-2 py-1 text-sm text-white outline-none"
                          />
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSaveEditFolder();
                            }}
                            className="p-1 hover:bg-[rgba(255,107,53,0.1)] rounded text-[#FF6B35]"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleCancelEditFolder();
                            }}
                            className="p-1 hover:bg-[rgba(255,107,53,0.1)] rounded text-[#9CA3AF]"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        // Normal view mode
                        <>
                          <button
                            onClick={() => toggleFolder(folder.id)}
                            className="flex-1 flex items-center gap-2"
                          >
                            {isFolderExpanded ? (
                              <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
                            )}
                            {isFolderExpanded ? (
                              <FolderOpen className="w-4 h-4 text-[#FF6B35]" />
                            ) : (
                              <Folder className="w-4 h-4 text-[#9CA3AF]" />
                            )}
                            <AnimatePresence>
                              <motion.span 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 text-left text-sm text-white"
                              >
                                {folder.name}
                              </motion.span>
                            </AnimatePresence>
                            <AnimatePresence>
                              <motion.span 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="px-2 py-0.5 bg-[rgba(255,107,53,0.15)] text-[#FF6B35] rounded-full text-xs"
                              >
                                {folder.sheets.length}
                              </motion.span>
                            </AnimatePresence>
                          </button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[rgba(255,107,53,0.1)] rounded"
                              >
                                <MoreVertical className="w-4 h-4 text-[#9CA3AF]" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent 
                              className="bg-[#1A1F2E] border-[rgba(255,107,53,0.3)] w-56"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem 
                                className="text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] cursor-pointer focus:bg-[rgba(255,107,53,0.1)] focus:text-[#FF6B35]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddDataCapture?.(currentSpace.id, folder.id);
                                }}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Data Capture
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] cursor-pointer focus:bg-[rgba(255,107,53,0.1)] focus:text-[#FF6B35]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartCreateFolder(currentSpace.id);
                                }}
                              >
                                <FolderPlus className="w-4 h-4 mr-2" />
                                Add Folder
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-[rgba(255,107,53,0.2)]" />
                              <DropdownMenuItem 
                                className="text-[#E5E7EB] hover:bg-[rgba(255,107,53,0.1)] hover:text-[#FF6B35] cursor-pointer focus:bg-[rgba(255,107,53,0.1)] focus:text-[#FF6B35]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditFolder(currentSpace.id, folder.id, folder.name);
                                }}
                              >
                                <Edit2 className="w-4 h-4 mr-2" />
                                Rename Folder
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-[rgba(255,107,53,0.2)]" />
                              <DropdownMenuItem 
                                className="text-red-400 hover:bg-red-400/10 hover:text-red-300 cursor-pointer focus:bg-red-400/10 focus:text-red-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (showDeleteConfirm === folder.id) {
                                    handleDeleteFolder(currentSpace.id, folder.id);
                                  } else {
                                    setShowDeleteConfirm(folder.id);
                                    setTimeout(() => setShowDeleteConfirm(null), 3000);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {showDeleteConfirm === folder.id ? 'Click again to confirm' : 'Delete Folder'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>

                    {/* Sheets */}
                    <AnimatePresence>
                      {isFolderExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="ml-8 overflow-hidden"
                        >
                          {folder.sheets.map((sheet) => {
                            const isSelected = selectedSheet === sheet.id;
                            
                            return (
                              <button
                                key={sheet.id}
                                onClick={() => onSelectSheet(currentSpace.id, folder.id, sheet.id)}
                                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors group mb-1 ${
                                  isSelected
                                    ? 'bg-[rgba(255,107,53,0.15)]'
                                    : 'hover:bg-[rgba(255,107,53,0.05)]'
                                }`}
                              >
                                <FileSpreadsheet className={`w-4 h-4 ${isSelected ? 'text-[#FF6B35]' : 'text-[#6B7280]'}`} />
                                <div className="flex-1 text-left">
                                  <div className={`text-sm ${isSelected ? 'text-[#FF6B35]' : 'text-[#E5E7EB]'}`}>
                                    {sheet.name}
                                  </div>
                                  <div className="text-xs text-[#6B7280]">
                                    {sheet.rowCount} rows • {sheet.lastModified}
                                  </div>
                                  {/* ⚠️ SYNCED: Analysis settings from CaptureOptionsModal */}
                                  {(sheet.llmProvider || sheet.schedule || sheet.analysisType === 'one-time') && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                      {sheet.llmProvider && (
                                        <span className="text-[10px] text-[#FF6B35] flex items-center gap-1 px-1.5 py-0.5 bg-[rgba(255,107,53,0.1)] rounded">
                                          <Brain className="w-3 h-3" />
                                          {sheet.llmProvider.name}
                                        </span>
                                      )}
                                      {sheet.schedule && (
                                        <span className="text-[10px] text-[#60A5FA] flex items-center gap-1 px-1.5 py-0.5 bg-[rgba(96,165,250,0.1)] rounded">
                                          <Clock className="w-3 h-3" />
                                          {sheet.schedule.frequency.charAt(0).toUpperCase() + sheet.schedule.frequency.slice(1)}
                                        </span>
                                      )}
                                      {sheet.analysisType === 'one-time' && !sheet.llmProvider && !sheet.schedule && (
                                        <span className="text-[10px] text-[#10B981] flex items-center gap-1 px-1.5 py-0.5 bg-[rgba(16,185,129,0.1)] rounded">
                                          <Sparkles className="w-3 h-3" />
                                          One-time
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
              
              {/* New Folder Creation UI */}
              {creatingFolder && creatingFolder.projectId === currentSpace.id && (
                <div className="mb-2">
                  <div className="w-full flex items-center gap-2 px-2 py-2 bg-[rgba(255,107,53,0.05)] rounded-lg">
                    <div className="flex-1 flex items-center gap-2">
                      <div className="w-4 h-4" /> {/* Spacer for alignment */}
                      <input
                        ref={createInputRef}
                        type="text"
                        value={creatingFolder.name}
                        onChange={(e) => setCreatingFolder({ ...creatingFolder, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveCreateFolder();
                          } else if (e.key === 'Escape') {
                            handleCancelCreateFolder();
                          }
                        }}
                        className="flex-1 bg-[#0A0E1A] border border-[#FF6B35] rounded px-2 py-1 text-sm text-white outline-none"
                      />
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSaveCreateFolder();
                        }}
                        className="p-1 hover:bg-[rgba(255,107,53,0.1)] rounded text-[#FF6B35]"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleCancelCreateFolder();
                        }}
                        className="p-1 hover:bg-[rgba(255,107,53,0.1)] rounded text-[#9CA3AF]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="px-2 py-4 text-center text-[#6B7280] text-sm">
              No Space selected
            </div>
          )}
        </motion.div>
      )}
```

---

## KEY CHANGES SUMMARY:

1. **Header**: "Spaces" → "Folders"
2. **Map Source**: `projects.map((project) =>` → `foldersToDisplay.map((folder) =>`
3. **No Project Accordion**: Folders are now top-level items
4. **Space ID Usage**: All operations use `currentSpace.id` instead of `project.id`
5. **Folder Icons**: Added FolderOpen icon (orange) for expanded state
6. **Folder Names**: Changed from gray to white text
7. **Sheet Nesting**: Changed from `ml-6` to `ml-8` for better visual hierarchy
8. **Null Check**: Added `{currentSpace ? ... : "No Space selected"}` wrapper

---

## VERIFICATION:

After making this replacement, verify:
- [ ] Sidebar shows "Folders" header
- [ ] Only folders from current Space appear
- [ ] No project accordion wrapper
- [ ] Folder names are white
- [ ] Count badges are orange
- [ ] Expanded folders show orange icon
- [ ] All folder operations work
- [ ] Sheet selection works
- [ ] Creating new folder works
