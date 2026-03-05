import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  X,
  Play,
  Settings2,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { toast } from 'sonner';

interface AgentSkill {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  skillType: string | null;
  config: any;
  promptTemplate: string | null;
  isSystem: boolean;
  createdBy: string | null;
}

interface WorkspaceSkillEntry {
  id: string;
  skillId: string;
  workspaceId: string | null;
  spaceId: string;
  isEnabled: boolean;
  config: any;
  skill: AgentSkill;
}

interface SkillsDashboardProps {
  workspaceId: string;
  spaceId: string;
  onClose: () => void;
  onSaveToCanvas?: (content: string, title: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  analysis: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  monitoring: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  reporting: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  cleaning: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

export function SkillsDashboard({ workspaceId, spaceId, onClose, onSaveToCanvas }: SkillsDashboardProps) {
  const queryClient = useQueryClient();
  const [scopeMode, setScopeMode] = useState<'workspace' | 'space'>('workspace');
  const [runningSkillId, setRunningSkillId] = useState<string | null>(null);
  const [skillResult, setSkillResult] = useState<{ skillName: string; result: string } | null>(null);
  const [expandedConfigId, setExpandedConfigId] = useState<string | null>(null);

  // Fetch all available skills
  const { data: allSkills = [] } = useQuery<AgentSkill[]>({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/skills');
      return res.json();
    },
  });

  // Fetch enabled skills for this workspace
  const { data: enabledSkills = [] } = useQuery<WorkspaceSkillEntry[]>({
    queryKey: ['workspace-skills', workspaceId, spaceId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/skills/workspace/${workspaceId}`);
      return res.json();
    },
    enabled: !!workspaceId,
  });

  const enabledSkillIds = new Set(enabledSkills.map(es => es.skillId));

  // Enable skill mutation
  const enableMutation = useMutation({
    mutationFn: async (skillId: string) => {
      const res = await apiRequest('POST', `/api/skills/${skillId}/enable`, {
        workspaceId: scopeMode === 'workspace' ? workspaceId : null,
        spaceId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-skills'] });
      toast.success('Skill enabled');
    },
    onError: () => toast.error('Failed to enable skill'),
  });

  // Disable skill mutation
  const disableMutation = useMutation({
    mutationFn: async (skillId: string) => {
      await apiRequest('POST', `/api/skills/${skillId}/disable`, {
        workspaceId: scopeMode === 'workspace' ? workspaceId : null,
        spaceId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-skills'] });
      toast.success('Skill disabled');
    },
    onError: () => toast.error('Failed to disable skill'),
  });

  // Run skill mutation
  const runMutation = useMutation({
    mutationFn: async (skillId: string) => {
      setRunningSkillId(skillId);
      const res = await apiRequest('POST', `/api/skills/${skillId}/run`, {
        workspaceId,
        spaceId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setRunningSkillId(null);
      setSkillResult({ skillName: data.skillName, result: data.result });
      toast.success(`${data.skillName} completed`);
    },
    onError: (error: any) => {
      setRunningSkillId(null);
      toast.error(error.message || 'Skill execution failed');
    },
  });

  // Separate active from available
  const activeSkills = allSkills.filter(s => enabledSkillIds.has(s.id));
  const availableSkills = allSkills.filter(s => !enabledSkillIds.has(s.id));

  // Group available by category
  const groupedAvailable = availableSkills.reduce<Record<string, AgentSkill[]>>((acc, skill) => {
    const cat = skill.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col bg-[#0F1923] border-l border-[rgba(255,107,53,0.15)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[rgba(255,107,53,0.1)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#FF6B35]" />
          <span className="text-sm font-medium text-white">Skills</span>
          {activeSkills.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-[#FF6B35]/20 text-[#FF6B35] rounded-full">
              {activeSkills.length}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[rgba(255,107,53,0.1)] text-[#9CA3AF] hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scope Toggle */}
      <div className="px-4 py-2 border-b border-[rgba(255,107,53,0.05)]">
        <div className="flex items-center gap-1 bg-[#1A2735] rounded-lg p-0.5 text-xs">
          <button
            onClick={() => setScopeMode('workspace')}
            className={`flex-1 px-3 py-1.5 rounded-md transition-all ${
              scopeMode === 'workspace' ? 'bg-[#FF6B35] text-white' : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            This Workspace
          </button>
          <button
            onClick={() => setScopeMode('space')}
            className={`flex-1 px-3 py-1.5 rounded-md transition-all ${
              scopeMode === 'space' ? 'bg-[#FF6B35] text-white' : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            All Workspaces
          </button>
        </div>
      </div>

      {/* Skill Result Panel */}
      <AnimatePresence>
        {skillResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-[rgba(255,107,53,0.15)]"
          >
            <div className="p-4 bg-[#1A2735]/80 max-h-[300px] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#FF6B35]">{skillResult.skillName} Results</span>
                <div className="flex gap-1">
                  {onSaveToCanvas && (
                    <button
                      onClick={() => {
                        onSaveToCanvas(skillResult.result, `${skillResult.skillName} Analysis`);
                        setSkillResult(null);
                        toast.success('Saved to canvas');
                      }}
                      className="px-2 py-1 text-[10px] bg-[#FF6B35]/20 text-[#FF6B35] rounded hover:bg-[#FF6B35]/30"
                    >
                      Save to Canvas
                    </button>
                  )}
                  <button
                    onClick={() => setSkillResult(null)}
                    className="px-2 py-1 text-[10px] text-[#9CA3AF] rounded hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <div className="text-xs text-[#D1D5DB] whitespace-pre-wrap leading-relaxed">
                {skillResult.result}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skills List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Active Skills */}
        {activeSkills.length > 0 && (
          <div>
            <h3 className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">Active Skills</h3>
            <div className="grid grid-cols-1 gap-2">
              {activeSkills.map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  isEnabled={true}
                  isRunning={runningSkillId === skill.id}
                  isExpanded={expandedConfigId === skill.id}
                  enabledEntry={enabledSkills.find(es => es.skillId === skill.id)}
                  onToggle={() => disableMutation.mutate(skill.id)}
                  onRun={() => runMutation.mutate(skill.id)}
                  onToggleConfig={() => setExpandedConfigId(expandedConfigId === skill.id ? null : skill.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Available Skills */}
        {Object.entries(groupedAvailable).map(([category, skills]) => (
          <div key={category}>
            <h3 className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">
              {category}
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {skills.map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  isEnabled={false}
                  isRunning={false}
                  isExpanded={false}
                  onToggle={() => enableMutation.mutate(skill.id)}
                  onRun={() => {}}
                />
              ))}
            </div>
          </div>
        ))}

        {allSkills.length === 0 && (
          <div className="text-center py-10">
            <Zap className="w-6 h-6 text-[#FF6B35]/30 mx-auto mb-2" />
            <p className="text-xs text-[#6B7280]">No skills available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  isEnabled,
  isRunning,
  isExpanded,
  enabledEntry,
  onToggle,
  onRun,
  onToggleConfig,
}: {
  skill: AgentSkill;
  isEnabled: boolean;
  isRunning: boolean;
  isExpanded?: boolean;
  enabledEntry?: WorkspaceSkillEntry;
  onToggle: () => void;
  onRun: () => void;
  onToggleConfig?: () => void;
}) {
  const catColor = CATEGORY_COLORS[skill.category || ''] || CATEGORY_COLORS.analysis;

  return (
    <div className={`rounded-lg border p-3 transition-colors ${
      isEnabled
        ? 'bg-[#1A2735]/80 border-[rgba(255,107,53,0.15)]'
        : 'bg-[#1A2735]/40 border-[rgba(255,107,53,0.05)] opacity-70 hover:opacity-100'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-white truncate">{skill.name}</span>
            <span className={`px-1.5 py-0.5 text-[9px] rounded-full border ${catColor}`}>
              {skill.category}
            </span>
          </div>
          {skill.description && (
            <p className="text-[10px] text-[#9CA3AF] line-clamp-2">{skill.description}</p>
          )}
          {enabledEntry?.workspaceId === null && isEnabled && (
            <span className="text-[9px] text-[#6B7280] mt-1 inline-block">All workspaces</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isEnabled && (
            <>
              {onToggleConfig && (
                <button
                  onClick={onToggleConfig}
                  className="p-1 rounded hover:bg-[rgba(255,107,53,0.1)] text-[#6B7280] hover:text-white"
                  title="Configure"
                >
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                </button>
              )}
              <button
                onClick={onRun}
                disabled={isRunning}
                className="p-1 rounded hover:bg-[rgba(255,107,53,0.1)] text-[#FF6B35] disabled:opacity-50"
                title="Run Now"
              >
                {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-[rgba(255,107,53,0.1)]"
            title={isEnabled ? 'Disable' : 'Enable'}
          >
            {isEnabled
              ? <ToggleRight className="w-4 h-4 text-emerald-400" />
              : <ToggleLeft className="w-4 h-4 text-[#6B7280]" />
            }
          </button>
        </div>
      </div>

      {/* Expanded Config Panel */}
      <AnimatePresence>
        {isExpanded && isEnabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-[rgba(255,107,53,0.1)]">
              <p className="text-[10px] text-[#6B7280] mb-1">Configuration</p>
              <pre className="text-[10px] text-[#9CA3AF] bg-[#0F1923] p-2 rounded overflow-x-auto">
                {JSON.stringify(enabledEntry?.config || skill.config || {}, null, 2)}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
