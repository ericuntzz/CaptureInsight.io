/**
 * BACKUP: Add to Project & Folder Button Component
 * 
 * This button was removed from CaptureOptionsModal due to bugs and complexity.
 * It was located in the Action Buttons section below the captures list.
 * 
 * Original Location: /components/CaptureOptionsModal.tsx
 * Lines: ~843-853
 * 
 * Purpose: Opened the assignment popup to assign selected captures to projects/folders
 * 
 * Issue: This button became buggy with empty array handling and was causing runtime errors.
 * The functionality is still accessible via the subtitle clickable areas (project/folder names)
 * in each capture item.
 */

import React from 'react';

interface AddToProjectFolderButtonProps {
  onClick: (e: React.MouseEvent) => void;
  capturesCollapsed?: boolean;
}

/**
 * Button that opens the assignment popup for assigning captures to projects/folders
 * 
 * Usage:
 * ```tsx
 * {!capturesCollapsed && (
 *   <div className="mt-3 flex items-center gap-2">
 *     <AddToProjectFolderButton onClick={(e) => handleOpenAssignmentPopup(e)} />
 *   </div>
 * )}
 * ```
 */
export function AddToProjectFolderButton({ onClick, capturesCollapsed = false }: AddToProjectFolderButtonProps) {
  // Only render when captures are not collapsed
  if (capturesCollapsed) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs bg-[#FF6B35] text-white rounded-lg hover:bg-[#FF7A47] transition-all"
    >
      Add to Project & Folder
    </button>
  );
}

/**
 * Original inline code (for reference):
 * 
 * {!capturesCollapsed && (
 *   <div className="mt-3 flex items-center gap-2">
 *     <button
 *       onClick={(e) => handleOpenAssignmentPopup(e)}
 *       className="px-3 py-1.5 text-xs bg-[#FF6B35] text-white rounded-lg hover:bg-[#FF7A47] transition-all"
 *     >
 *       Add to Project & Folder
 *     </button>
 *   </div>
 * )}
 * 
 * Handler function reference (handleOpenAssignmentPopup):
 * - Checks if any captures are selected or assigned
 * - Shows warning if no captures to assign
 * - Opens assignment popup with project/folder selection
 * - Sets popup position based on button position
 */
