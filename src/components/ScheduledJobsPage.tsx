import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  Plus,
  Trash2,
  Loader2,
  Play,
  Pause,
  History,
  X,
  Zap,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';
import { toast } from 'sonner';

interface AgentSkill {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

interface ScheduledJob {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  spaceId: string;
  workspaceId: string | null;
  skillId: string;
  cronExpression: string;
  timezone: string | null;
  isEnabled: boolean;
  config: any;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  skill: AgentSkill;
}

interface JobRun {
  id: string;
  jobId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  result: string | null;
  error: string | null;
  durationMs: number | null;
}

interface ScheduledJobsPageProps {
  spaces: Array<{ id: string; name: string }>;
  currentSpaceId?: string | null;
}

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at 9am', value: '0 9 * * *' },
  { label: 'Every Monday at 9am', value: '0 9 * * 1' },
  { label: 'Every weekday at 9am', value: '0 9 * * 1-5' },
  { label: 'Every 1st of month', value: '0 9 1 * *' },
];

function formatCron(cron: string): string {
  const preset = CRON_PRESETS.find(p => p.value === cron);
  if (preset) return preset.label;
  return cron;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ScheduledJobsPage({ spaces, currentSpaceId }: ScheduledJobsPageProps) {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [filterSpaceId, setFilterSpaceId] = useState<string>(currentSpaceId || '');

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSpaceId, setFormSpaceId] = useState(currentSpaceId || '');
  const [formSkillId, setFormSkillId] = useState('');
  const [formCronExpression, setFormCronExpression] = useState('0 9 * * 1');
  const [formTimezone, setFormTimezone] = useState('UTC');

  // Fetch jobs
  const { data: jobs = [], isLoading } = useQuery<ScheduledJob[]>({
    queryKey: ['/api/scheduled-jobs', filterSpaceId],
    queryFn: async () => {
      const params = filterSpaceId ? `?spaceId=${filterSpaceId}` : '';
      const res = await apiRequest('GET', `/api/scheduled-jobs${params}`);
      return res.json();
    },
  });

  // Fetch available skills
  const { data: skills = [] } = useQuery<AgentSkill[]>({
    queryKey: ['/api/skills'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/skills');
      return res.json();
    },
  });

  // Create job
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/scheduled-jobs', {
        name: formName,
        description: formDescription || null,
        spaceId: formSpaceId,
        skillId: formSkillId,
        cronExpression: formCronExpression,
        timezone: formTimezone,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-jobs'] });
      toast.success('Scheduled job created');
      setShowCreateForm(false);
      setFormName('');
      setFormDescription('');
      setFormSkillId('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create job');
    },
  });

  // Toggle enabled
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const res = await apiRequest('PATCH', `/api/scheduled-jobs/${id}`, { isEnabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-jobs'] });
    },
  });

  // Delete job
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/scheduled-jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-jobs'] });
      toast.success('Job deleted');
    },
  });

  return (
    <div className="h-full flex flex-col bg-[#1A1A1A] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-[#2A2A2A]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF6B35]/20 to-[#FF6B35]/5 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#FF6B35]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Scheduled Jobs</h1>
              <p className="text-sm text-[#6B7280]">Automate skill execution on a recurring schedule</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-[#FF8F65] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New Job
          </button>
        </div>

        {/* Space filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B7280]">Space:</span>
          <select
            value={filterSpaceId}
            onChange={(e) => setFilterSpaceId(e.target.value)}
            className="text-xs bg-[#2A2A2A] text-white border border-[#3A3A3A] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#FF6B35]"
          >
            <option value="">All spaces</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <span className="text-xs text-[#6B7280] ml-auto">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#FF6B35]" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="w-12 h-12 text-[#3A3A3A] mb-3" />
            <p className="text-gray-400 text-sm mb-1">No scheduled jobs yet</p>
            <p className="text-gray-500 text-xs">Create a job to automatically run skills on a schedule</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                expanded={expandedJobId === job.id}
                onToggleExpand={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                onToggleEnabled={() => toggleMutation.mutate({ id: job.id, isEnabled: !job.isEnabled })}
                onDelete={() => {
                  if (confirm(`Delete "${job.name}"? This cannot be undone.`)) {
                    deleteMutation.mutate(job.id);
                  }
                }}
                spaces={spaces}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Create Form Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-6 w-[480px] max-h-[80vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-white">Create Scheduled Job</h2>
                <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1">Job Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Weekly Sales Report"
                    className="w-full bg-[#2A2A2A] text-white text-sm border border-[#3A3A3A] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#FF6B35]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description of this job"
                    className="w-full bg-[#2A2A2A] text-white text-sm border border-[#3A3A3A] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#FF6B35]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1">Space</label>
                  <select
                    value={formSpaceId}
                    onChange={(e) => setFormSpaceId(e.target.value)}
                    className="w-full bg-[#2A2A2A] text-white text-sm border border-[#3A3A3A] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#FF6B35]"
                  >
                    <option value="">Select a space...</option>
                    {spaces.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1">Skill to Run</label>
                  <select
                    value={formSkillId}
                    onChange={(e) => setFormSkillId(e.target.value)}
                    className="w-full bg-[#2A2A2A] text-white text-sm border border-[#3A3A3A] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#FF6B35]"
                  >
                    <option value="">Select a skill...</option>
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} — {s.category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1">Schedule</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {CRON_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setFormCronExpression(preset.value)}
                        className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                          formCronExpression === preset.value
                            ? 'bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/30'
                            : 'bg-[#2A2A2A] text-[#9CA3AF] border-[#3A3A3A] hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={formCronExpression}
                    onChange={(e) => setFormCronExpression(e.target.value)}
                    placeholder="Cron expression (e.g., 0 9 * * 1)"
                    className="w-full bg-[#2A2A2A] text-white text-sm border border-[#3A3A3A] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#FF6B35] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1">Timezone</label>
                  <select
                    value={formTimezone}
                    onChange={(e) => setFormTimezone(e.target.value)}
                    className="w-full bg-[#2A2A2A] text-white text-sm border border-[#3A3A3A] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#FF6B35]"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern (ET)</option>
                    <option value="America/Chicago">Central (CT)</option>
                    <option value="America/Denver">Mountain (MT)</option>
                    <option value="America/Los_Angeles">Pacific (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Europe/Berlin">Berlin (CET)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                  </select>
                </div>

                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!formName || !formSpaceId || !formSkillId || !formCronExpression || createMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#FF6B35] to-[#FF8F65] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create Job
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JobCard({
  job,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onDelete,
  spaces,
}: {
  job: ScheduledJob;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  spaces: Array<{ id: string; name: string }>;
}) {
  const spaceName = spaces.find(s => s.id === job.spaceId)?.name || 'Unknown';

  // Fetch runs when expanded
  const { data: runs = [], isLoading: runsLoading } = useQuery<JobRun[]>({
    queryKey: ['/api/scheduled-jobs', job.id, 'runs'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/scheduled-jobs/${job.id}/runs?limit=10`);
      return res.json();
    },
    enabled: expanded,
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`bg-[#1E1E1E] border rounded-lg overflow-hidden transition-colors ${
        job.isEnabled ? 'border-[#2A2A2A]' : 'border-[#2A2A2A] opacity-60'
      }`}
    >
      {/* Job header */}
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={onToggleEnabled}
          className="flex-shrink-0"
          title={job.isEnabled ? 'Disable job' : 'Enable job'}
        >
          {job.isEnabled ? (
            <Play className="w-4 h-4 text-green-400" />
          ) : (
            <Pause className="w-4 h-4 text-gray-500" />
          )}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggleExpand}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{job.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2A2A2A] text-[#9CA3AF] border border-[#3A3A3A]">
              {job.skill.name}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatCron(job.cronExpression)}
            </span>
            <span>{spaceName}</span>
            {job.nextRunAt && (
              <span>Next: {formatDate(job.nextRunAt)}</span>
            )}
            {job.lastRunAt && (
              <span>Last: {formatDate(job.lastRunAt)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onToggleExpand}
            className="p-1.5 text-gray-500 hover:text-white rounded-md hover:bg-[#2A2A2A] transition-colors"
            title="View history"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-500 hover:text-red-400 rounded-md hover:bg-[#2A2A2A] transition-colors"
            title="Delete job"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Run history panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[#2A2A2A] overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-[#9CA3AF]" />
                <span className="text-xs font-medium text-[#9CA3AF]">Run History</span>
              </div>

              {runsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-[#FF6B35]" />
                </div>
              ) : runs.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No runs yet</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {runs.map((run) => (
                    <RunRow key={run.id} run={run} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RunRow({ run }: { run: JobRun }) {
  const [showResult, setShowResult] = useState(false);

  return (
    <div className="bg-[#252525] rounded-md p-2.5">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowResult(!showResult)}>
        {run.status === 'success' ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
        ) : run.status === 'failed' ? (
          <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
        ) : (
          <Loader2 className="w-3.5 h-3.5 text-[#FF6B35] animate-spin flex-shrink-0" />
        )}
        <span className="text-xs text-[#9CA3AF] flex-1">
          {formatDate(run.startedAt)}
        </span>
        <span className="text-[10px] text-[#6B7280]">
          {formatDuration(run.durationMs)}
        </span>
        {(run.result || run.error) && (
          <ChevronDown className={`w-3 h-3 text-[#6B7280] transition-transform ${showResult ? 'rotate-180' : ''}`} />
        )}
      </div>

      {showResult && (
        <div className="mt-2 text-xs bg-[#1A1A1A] rounded p-2 max-h-40 overflow-y-auto">
          {run.error ? (
            <p className="text-red-400">{run.error}</p>
          ) : (
            <p className="text-[#9CA3AF] whitespace-pre-wrap">{run.result}</p>
          )}
        </div>
      )}
    </div>
  );
}
