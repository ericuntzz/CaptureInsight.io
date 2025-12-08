import { storage } from '../storage';

export interface WorkspaceValidationResult {
  valid: boolean;
  error?: {
    status: number;
    message: string;
    errorCode: string;
    details: string;
  };
}

export async function validateWorkspaceForSpace(
  workspaceId: string | null | undefined,
  spaceId: string
): Promise<WorkspaceValidationResult> {
  if (!workspaceId) {
    return { valid: true };
  }

  const workspace = await storage.getWorkspace(workspaceId);
  
  if (!workspace) {
    return {
      valid: false,
      error: {
        status: 400,
        message: "Invalid workspace ID",
        errorCode: "WORKSPACE_NOT_FOUND",
        details: `Workspace with ID '${workspaceId}' does not exist`
      }
    };
  }

  if (workspace.spaceId !== spaceId) {
    return {
      valid: false,
      error: {
        status: 400,
        message: "Invalid workspace ID",
        errorCode: "WORKSPACE_SPACE_MISMATCH",
        details: `Workspace does not belong to this space`
      }
    };
  }

  return { valid: true };
}
