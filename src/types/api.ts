import type { DataSource } from '../components/DataSourceSidebar';
import type { Tag } from '../data/insightsData';

export interface Sheet {
  id: string;
  name: string;
  rowCount: number;
  lastModified: string;
  analysisType?: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
  llmProvider?: { id: string; name: string };
  schedule?: { frequency: string; time: string };
  dataSource?: DataSource;
}

export interface Workspace {
  id: string;
  name: string;
  sheets: Sheet[];
}

export interface Folder extends Workspace {}

export interface Project {
  id: string;
  name: string;
  description: string;
  workspaces: Workspace[];
  folders: Workspace[];
  goals?: string;
  instructions?: string;
  tags?: Tag[];
}

export interface Space {
  id: string;
  name: string;
  description?: string;
  workspaces: Workspace[];
  folders: Workspace[];
  goals?: string;
  instructions?: string;
  tags?: Tag[];
}

export interface CaptureDestination {
  projectId?: string;
  spaceId?: string;
  workspaceId: string;
  folderId?: string;
}

export interface CaptureDestinationWithSpace {
  spaceId: string;
  workspaceId: string;
  folderId?: string;
}

export interface CaptureDestinationWithProject {
  projectId: string;
  workspaceId: string;
  folderId?: string;
}

export interface CaptureSettings {
  destination: CaptureDestinationWithSpace | CaptureDestinationWithProject;
  analysisType: 'one-time' | 'scheduled' | 'llm-integration' | 'api' | null;
  llmProvider?: { id: string; name: string };
  schedule?: { frequency: string; time: string };
}

export interface CaptureSettingsData {
  destination?: { spaceId: string; workspaceId: string; folderId?: string };
  analysisType?: 'one-time' | 'scheduled' | null;
  analysisFrequency?: string;
  analysisTime?: string;
  selectedLlmId?: string | null;
}

export function spaceToProject(space: Space): Project {
  return {
    ...space,
    description: space.description || '',
  };
}

export function projectToSpace(project: Project): Space {
  return {
    ...project,
    description: project.description,
  };
}

export function spacesToProjects(spaces: Space[]): Project[] {
  return spaces.map(spaceToProject);
}

export function projectsToSpaces(projects: Project[]): Space[] {
  return projects.map(projectToSpace);
}

export function convertDestinationToSpace(dest: CaptureDestinationWithProject): CaptureDestinationWithSpace {
  return {
    spaceId: dest.projectId,
    workspaceId: dest.workspaceId,
    folderId: dest.folderId,
  };
}

export function convertDestinationToProject(dest: CaptureDestinationWithSpace): CaptureDestinationWithProject {
  return {
    projectId: dest.spaceId,
    workspaceId: dest.workspaceId,
    folderId: dest.folderId,
  };
}
