import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  X,
  Lightbulb,
  Loader2,
  Cloud,
  Check,
} from "lucide-react";
import { CleaningPipeline, CleaningPipelineState } from "../components/CleaningPipeline";

type Section = "rules" | "renaming" | "kpis" | "ai-hints";

interface ColumnRename {
  id: string;
  from: string;
  to: string;
  aliases: string[];
  showAliases: boolean;
  newAlias: string;
  suggestedAliases: string[];
}

interface RulesPanelProps {
  workspaceId: string;
  workspaceName: string;
  workspaces: Array<{ id: string; name: string }>;
  onWorkspaceChange: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
  onSave: (section: string, data: any) => Promise<void>;
  initialData?: {
    cleaningRules?: any;
    columnRenames?: ColumnRename[];
    selectedKPIs?: string[];
    aiHints?: string;
  };
}

export function RulesPanel({
  workspaceId,
  workspaceName,
  workspaces,
  onWorkspaceChange,
  onCreateWorkspace,
  onSave,
  initialData,
}: RulesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<{
    [key in Section]?: boolean;
  }>({
    rules: false,
    renaming: false,
    kpis: false,
    "ai-hints": false,
  });

  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);

  const [columnRenames, setColumnRenames] = useState<ColumnRename[]>(
    initialData?.columnRenames || [
      {
        id: "1",
        from: "",
        to: "",
        aliases: [],
        showAliases: false,
        newAlias: "",
        suggestedAliases: [
          "Cost",
          "Total Spend",
          "Amount",
          "Spend",
          "Ad Cost",
        ],
      },
    ]
  );

  const [selectedKPIs, setSelectedKPIs] = useState<string[]>(
    initialData?.selectedKPIs || []
  );

  const [aiHints, setAiHints] = useState<string>(initialData?.aiHints || "");

  const [cleaningRules, setCleaningRules] = useState<CleaningPipelineState | null>(
    initialData?.cleaningRules || null
  );

  const [_dirtyState, setDirtyState] = useState<{
    [key in Section]?: boolean;
  }>({});

  const [_savingState, setSavingState] = useState<{
    [key in Section]?: boolean;
  }>({});

  const [saveStatus, setSaveStatus] = useState<{
    [key in Section]?: 'idle' | 'saving' | 'saved';
  }>({
    rules: 'idle',
    renaming: 'idle',
    kpis: 'idle',
    'ai-hints': 'idle',
  });

  const savedStatusTimeouts = useRef<{ [key in Section]?: NodeJS.Timeout }>({});
  const autoSaveTimeouts = useRef<{ [key in Section]?: NodeJS.Timeout }>({});

  const [_initialColumnRenames] = useState(JSON.stringify(columnRenames));
  const [_initialSelectedKPIs] = useState(JSON.stringify(selectedKPIs));
  const [_initialAiHints] = useState(aiHints);
  const [_initialCleaningRules] = useState(JSON.stringify(cleaningRules));

  const [lastSavedColumnRenames, setLastSavedColumnRenames] = useState(JSON.stringify(columnRenames));
  const [lastSavedKPIs, setLastSavedKPIs] = useState(JSON.stringify(selectedKPIs));
  const [lastSavedAiHints, setLastSavedAiHints] = useState(aiHints);
  const [lastSavedCleaningRules, setLastSavedCleaningRules] = useState(JSON.stringify(cleaningRules));

  // Reset all state when workspace changes to prevent saving stale data to wrong workspace
  useEffect(() => {
    const defaultRenames: ColumnRename[] = [
      {
        id: "1",
        from: "",
        to: "",
        aliases: [],
        showAliases: false,
        newAlias: "",
        suggestedAliases: ["Cost", "Total Spend", "Amount", "Spend", "Ad Cost"],
      },
    ];
    
    // Clear any pending auto-save timeouts
    Object.values(autoSaveTimeouts.current).forEach(t => t && clearTimeout(t));
    Object.values(savedStatusTimeouts.current).forEach(t => t && clearTimeout(t));
    
    // Reset form data to new workspace's data
    const newColumnRenames = initialData?.columnRenames || defaultRenames;
    const newKPIs = initialData?.selectedKPIs || [];
    const newAiHints = initialData?.aiHints || "";
    const newCleaningRules = initialData?.cleaningRules || null;
    
    setColumnRenames(newColumnRenames);
    setSelectedKPIs(newKPIs);
    setAiHints(newAiHints);
    setCleaningRules(newCleaningRules);
    
    // Reset lastSaved values to prevent false dirty detection
    setLastSavedColumnRenames(JSON.stringify(newColumnRenames));
    setLastSavedKPIs(JSON.stringify(newKPIs));
    setLastSavedAiHints(newAiHints);
    setLastSavedCleaningRules(JSON.stringify(newCleaningRules));
    
    // Reset save statuses
    setSaveStatus({
      rules: 'idle',
      renaming: 'idle',
      kpis: 'idle',
      'ai-hints': 'idle',
    });
    setDirtyState({});
    setSavingState({});
  }, [workspaceId]);

  const triggerAutoSave = (section: Section) => {
    if (autoSaveTimeouts.current[section]) {
      clearTimeout(autoSaveTimeouts.current[section]);
    }
    autoSaveTimeouts.current[section] = setTimeout(() => {
      handleSaveSection(section);
    }, 500);
  };

  useEffect(() => {
    const isDirty = JSON.stringify(columnRenames) !== lastSavedColumnRenames;
    setDirtyState((prev) => ({ ...prev, renaming: isDirty }));
    if (isDirty) triggerAutoSave('renaming');
  }, [columnRenames]);

  useEffect(() => {
    const isDirty = JSON.stringify(selectedKPIs) !== lastSavedKPIs;
    setDirtyState((prev) => ({ ...prev, kpis: isDirty }));
    if (isDirty) triggerAutoSave('kpis');
  }, [selectedKPIs]);

  useEffect(() => {
    const isDirty = aiHints !== lastSavedAiHints;
    setDirtyState((prev) => ({ ...prev, 'ai-hints': isDirty }));
    if (isDirty) triggerAutoSave('ai-hints');
  }, [aiHints]);

  useEffect(() => {
    const isDirty = JSON.stringify(cleaningRules) !== lastSavedCleaningRules;
    setDirtyState((prev) => ({ ...prev, rules: isDirty }));
    if (isDirty) triggerAutoSave('rules');
  }, [cleaningRules]);

  useEffect(() => {
    return () => {
      Object.values(savedStatusTimeouts.current).forEach(t => t && clearTimeout(t));
      Object.values(autoSaveTimeouts.current).forEach(t => t && clearTimeout(t));
    };
  }, []);

  const kpiFormulas = [
    {
      id: "cpa",
      name: "CPA",
      fullName: "Cost Per Acquisition",
    },
    { id: "ctr", name: "CTR", fullName: "Click-Through Rate" },
    {
      id: "roas",
      name: "ROAS",
      fullName: "Return on Ad Spend",
    },
    { id: "cpc", name: "CPC", fullName: "Cost Per Click" },
    {
      id: "arpc",
      name: "ARPC",
      fullName: "Average Revenue Per Customer",
    },
    {
      id: "cac",
      name: "CAC",
      fullName: "Customer Acquisition Cost",
    },
    {
      id: "roi",
      name: "ROI",
      fullName: "Return on Investment",
    },
    { id: "cr", name: "CR", fullName: "Conversion Rate" },
  ];

  const toggleKPI = (kpiId: string) => {
    setSelectedKPIs((prev) =>
      prev.includes(kpiId)
        ? prev.filter((id) => id !== kpiId)
        : [...prev, kpiId]
    );
  };

  const selectWorkspace = (wsId: string) => {
    onWorkspaceChange(wsId);
    setShowWorkspaceDropdown(false);
  };

  const addRename = () => {
    const newId = (columnRenames.length + 1).toString();
    setColumnRenames([
      ...columnRenames,
      {
        id: newId,
        from: "",
        to: "",
        aliases: [],
        showAliases: false,
        newAlias: "",
        suggestedAliases: [],
      },
    ]);
  };

  const removeRename = (id: string) => {
    if (columnRenames.length > 1) {
      setColumnRenames(columnRenames.filter((rename) => rename.id !== id));
    }
  };

  const updateRename = (
    id: string,
    field: "from" | "to" | "newAlias",
    value: string
  ) => {
    setColumnRenames(
      columnRenames.map((rename) =>
        rename.id === id ? { ...rename, [field]: value } : rename
      )
    );
  };

  const toggleAliases = (id: string) => {
    setColumnRenames(
      columnRenames.map((rename) =>
        rename.id === id
          ? { ...rename, showAliases: !rename.showAliases }
          : rename
      )
    );
  };

  const addAlias = (id: string) => {
    setColumnRenames(
      columnRenames.map((rename) =>
        rename.id === id
          ? {
              ...rename,
              aliases: [...rename.aliases, rename.newAlias],
              newAlias: "",
            }
          : rename
      )
    );
  };

  const removeAlias = (id: string, alias: string) => {
    setColumnRenames(
      columnRenames.map((rename) =>
        rename.id === id
          ? {
              ...rename,
              aliases: rename.aliases.filter((a) => a !== alias),
            }
          : rename
      )
    );
  };

  const addSuggestedAlias = (id: string, suggestedAlias: string) => {
    setColumnRenames(
      columnRenames.map((rename) =>
        rename.id === id
          ? {
              ...rename,
              aliases: [...rename.aliases, suggestedAlias],
              suggestedAliases: rename.suggestedAliases.filter(
                (a) => a !== suggestedAlias
              ),
            }
          : rename
      )
    );
  };

  const toggleSection = (section: Section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSaveSection = async (section: Section) => {
    setSavingState((prev) => ({ ...prev, [section]: true }));
    setSaveStatus((prev) => ({ ...prev, [section]: 'saving' }));
    
    if (savedStatusTimeouts.current[section]) {
      clearTimeout(savedStatusTimeouts.current[section]);
    }
    
    try {
      let data: any;
      switch (section) {
        case "rules":
          data = cleaningRules;
          break;
        case "renaming":
          data = columnRenames;
          break;
        case "kpis":
          data = selectedKPIs;
          break;
        case "ai-hints":
          data = aiHints;
          break;
        default:
          data = {};
      }
      await onSave(section, data);
      setDirtyState((prev) => ({ ...prev, [section]: false }));
      
      switch (section) {
        case "rules":
          setLastSavedCleaningRules(JSON.stringify(cleaningRules));
          break;
        case "renaming":
          setLastSavedColumnRenames(JSON.stringify(columnRenames));
          break;
        case "kpis":
          setLastSavedKPIs(JSON.stringify(selectedKPIs));
          break;
        case "ai-hints":
          setLastSavedAiHints(aiHints);
          break;
      }
      
      setSaveStatus((prev) => ({ ...prev, [section]: 'saved' }));
      savedStatusTimeouts.current[section] = setTimeout(() => {
        setSaveStatus((prev) => ({ ...prev, [section]: 'idle' }));
      }, 3000);
    } catch (error) {
      setSaveStatus((prev) => ({ ...prev, [section]: 'idle' }));
    } finally {
      setSavingState((prev) => ({ ...prev, [section]: false }));
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0A0D12] flex flex-col items-stretch justify-center">
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(255, 107, 53, 0.15) 0%, rgba(10, 13, 18, 0) 50%)",
            filter: "blur(120px)",
          }}
        />
      </div>

      {/* Container 1: Page Title with Workspace Selector */}
      <div className="w-full flex justify-center pb-16 relative z-10">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white inline-flex items-center justify-center whitespace-nowrap gap-x-3">
            <span>Set Rules for How Data is Processed in</span>
            <span className="relative inline-block ml-3">
              <button
                onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
                className="text-4xl font-bold text-[#FF6B35] hover:text-[#FF8C5E] transition-colors inline-flex items-center gap-2"
              >
                {workspaceName}
                <ChevronDown
                  size={28}
                  className={`transition-transform ${showWorkspaceDropdown ? "rotate-180" : ""}`}
                />
              </button>
              {showWorkspaceDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowWorkspaceDropdown(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 bg-[#1A1F2E] border border-[#2A303C] rounded-xl overflow-hidden z-20 min-w-[280px] shadow-xl text-base font-normal">
                    {/* All Workspaces option */}
                    <button
                      onClick={() => selectWorkspace("all")}
                      className={`w-full px-4 py-2.5 text-left text-sm font-normal transition-colors ${
                        workspaceId === "all"
                          ? "bg-[#FF6B35] text-white"
                          : "text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-[#FF6B35]"
                      }`}
                    >
                      All Workspaces
                    </button>
                    {/* Divider */}
                    {workspaces.length > 0 && (
                      <div className="border-t border-[#2A303C]" />
                    )}
                    {/* Existing workspaces */}
                    {workspaces.map((workspace) => (
                      <button
                        key={workspace.id}
                        onClick={() => selectWorkspace(workspace.id)}
                        className={`w-full px-4 py-2.5 text-left text-sm font-normal transition-colors ${
                          workspace.id === workspaceId
                            ? "bg-[#FF6B35] text-white"
                            : "text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-[#FF6B35]"
                        }`}
                      >
                        {workspace.name}
                      </button>
                    ))}
                    {/* Divider */}
                    <div className="border-t border-[#2A303C]" />
                    {/* Create Workspace option */}
                    <button
                      onClick={() => {
                        setShowWorkspaceDropdown(false);
                        onCreateWorkspace();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm font-normal text-[#FF6B35] hover:bg-[rgba(255,107,53,0.1)] transition-colors flex items-center gap-2"
                    >
                      <Plus size={14} />
                      <span>Create Workspace</span>
                    </button>
                  </div>
                </>
              )}
            </span>
          </h1>
        </div>
      </div>

      {/* Container 2: Rules Sections */}
      <div className="w-full px-6">
        <div className="max-w-2xl w-full mx-auto relative z-10">
        {/* Section 1: Rules for your data */}
        <div className="mb-6 w-full">
          <div
            className="w-full bg-[#1A1F2E] rounded-2xl border border-[#2A303C] overflow-hidden"
            style={{
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
            }}
          >
            <button
              onClick={() => toggleSection("rules")}
              className="w-full px-8 py-6 flex items-center justify-between cursor-pointer hover:bg-[rgba(255,107,53,0.05)] transition-colors"
            >
              <h1 className="text-2xl text-white">Rules for your data</h1>
              <div className="flex items-center gap-3">
                {saveStatus.rules === 'saving' ? (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF6B35]" />
                    <span>Saving...</span>
                  </div>
                ) : saveStatus.rules === 'saved' ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                    <Check className="w-3 h-3 text-emerald-400 -ml-2.5 mt-0.5" />
                    <span className="text-emerald-400">Saved</span>
                  </div>
                ) : null}
                {expandedSections.rules ? (
                  <ChevronUp className="text-[#9CA3AF]" />
                ) : (
                  <ChevronDown className="text-[#9CA3AF]" />
                )}
              </div>
            </button>

            {expandedSections.rules && (
              <div className="px-8 pb-8">
                <h2 className="text-xl text-[#9CA3AF] mt-6 mb-2">
                  When data is uploaded to{" "}
                  <span className="text-[#FF6B35]">{workspaceName}</span>, how would you like it to be processed?
                </h2>
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-1 h-4 bg-[#FF6B35] rounded-full"></div>
                  <p className="text-sm italic text-[#6B7280]">
                    Rule will be applied to all columns
                  </p>
                </div>

                <CleaningPipeline onChange={setCleaningRules} />
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Column Renaming */}
        <div className="mb-6 w-full">
          <div
            className="w-full bg-[#1A1F2E] rounded-2xl border border-[#2A303C] overflow-hidden"
            style={{
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
            }}
          >
            <button
              onClick={() => toggleSection("renaming")}
              className="w-full px-8 py-6 flex items-center justify-between cursor-pointer hover:bg-[rgba(255,107,53,0.05)] transition-colors"
            >
              <h1 className="text-2xl text-white">Column Renaming</h1>
              <div className="flex items-center gap-3">
                {saveStatus.renaming === 'saving' ? (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF6B35]" />
                    <span>Saving...</span>
                  </div>
                ) : saveStatus.renaming === 'saved' ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                    <Check className="w-3 h-3 text-emerald-400 -ml-2.5 mt-0.5" />
                    <span className="text-emerald-400">Saved</span>
                  </div>
                ) : null}
                {expandedSections.renaming ? (
                  <ChevronUp className="text-[#9CA3AF]" />
                ) : (
                  <ChevronDown className="text-[#9CA3AF]" />
                )}
              </div>
            </button>

            {expandedSections.renaming && (
              <div className="px-8 pb-8">
                <h2 className="text-xl text-[#9CA3AF] mt-6 mb-2">
                  Are there any column headers that you would like to be renamed
                  when you upload data to{" "}
                  <span className="text-[#FF6B35]">{workspaceName}</span>?
                </h2>
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-1 h-4 bg-[#FF6B35] rounded-full"></div>
                  <h3 className="text-sm text-[#6B7280]">
                    I.e. change any columns that say "CTR" to "Click Through
                    Rate"
                  </h3>
                </div>

                <div className="space-y-4 mb-6">
                  {columnRenames.map((rename) => (
                    <div key={rename.id}>
                      <div className="flex gap-3 items-start">
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-[#9CA3AF] mb-2">
                              From
                            </label>
                            <input
                              type="text"
                              value={rename.from}
                              onChange={(e) =>
                                updateRename(rename.id, "from", e.target.value)
                              }
                              placeholder='e.g. "CTR"'
                              className="w-full px-4 py-3 bg-[#0A0D12] border border-[rgba(255,255,255,0.08)] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-[#9CA3AF] mb-2">
                              To
                            </label>
                            <input
                              type="text"
                              value={rename.to}
                              onChange={(e) =>
                                updateRename(rename.id, "to", e.target.value)
                              }
                              placeholder='e.g. "Click Through Rate"'
                              className="w-full px-4 py-3 bg-[#0A0D12] border border-[rgba(255,255,255,0.08)] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
                            />
                          </div>
                        </div>
                        {columnRenames.length > 1 && (
                          <button
                            onClick={() => removeRename(rename.id)}
                            className="mt-8 p-3 text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[#0A0D12] rounded-xl transition-colors"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>

                      <div className="ml-0 mt-3">
                        <button
                          onClick={() => toggleAliases(rename.id)}
                          className="flex items-center gap-2 text-xs text-[#6B7280] hover:text-[#9CA3AF] transition-colors"
                        >
                          <Lightbulb size={14} />
                          <span>Column Aliases (optional)</span>
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${rename.showAliases ? "rotate-180" : ""}`}
                          />
                        </button>

                        {rename.showAliases && (
                          <div className="mt-3 p-4 bg-[#0A0D12] rounded-lg border border-[rgba(255,255,255,0.05)]">
                            <div className="flex items-start gap-2 mb-3">
                              <Lightbulb
                                size={14}
                                className="text-[#6B7280] mt-0.5 flex-shrink-0"
                              />
                              <p className="text-xs text-[#6B7280]">
                                Help AI recognize this column even if the name
                                changes in future uploads
                              </p>
                            </div>

                            {rename.aliases.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {rename.aliases.map((alias, idx) => (
                                  <div
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1F2E] border border-[rgba(255,255,255,0.08)] rounded-full text-sm text-[#9CA3AF]"
                                  >
                                    <span>{alias}</span>
                                    <button
                                      onClick={() =>
                                        removeAlias(rename.id, alias)
                                      }
                                      className="hover:text-[#FF6B35] transition-colors"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={rename.newAlias}
                                onChange={(e) =>
                                  updateRename(
                                    rename.id,
                                    "newAlias",
                                    e.target.value
                                  )
                                }
                                onKeyPress={(e) => {
                                  if (
                                    e.key === "Enter" &&
                                    rename.newAlias.trim()
                                  ) {
                                    addAlias(rename.id);
                                  }
                                }}
                                placeholder="Add custom alias..."
                                className="flex-1 px-3 py-2 bg-[#0A0D12] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-white placeholder-[#6B7280] focus:outline-none focus:ring-1 focus:ring-[#FF6B35] focus:border-transparent"
                              />
                              <button
                                onClick={() => {
                                  if (rename.newAlias.trim()) {
                                    addAlias(rename.id);
                                  }
                                }}
                                disabled={!rename.newAlias.trim()}
                                className="px-4 py-2 bg-[#1A1F2E] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#9CA3AF] hover:text-[#FF6B35] hover:border-[#FF6B35] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Add
                              </button>
                            </div>

                            {rename.suggestedAliases.length > 0 && (
                              <div className="mt-4">
                                <h4 className="text-xs text-[#6B7280] mb-2">
                                  Suggested aliases:
                                </h4>
                                <div className="flex flex-wrap gap-3">
                                  {rename.suggestedAliases.map(
                                    (suggestedAlias, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() =>
                                          addSuggestedAlias(
                                            rename.id,
                                            suggestedAlias
                                          )
                                        }
                                        className="flex items-center gap-1.5 text-sm text-[#9CA3AF] hover:text-[#FF6B35] transition-colors"
                                      >
                                        <Plus size={14} />
                                        {suggestedAlias}
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addRename}
                    className="flex items-center gap-2 px-4 py-2 text-[#FF6B35] hover:bg-[#0A0D12] rounded-xl transition-colors"
                  >
                    <Plus size={20} />
                    Add another rename rule
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Create Calculated KPIs */}
        <div className="mb-6 w-full">
          <div
            className="w-full bg-[#1A1F2E] rounded-2xl border border-[#2A303C] overflow-hidden"
            style={{
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
            }}
          >
            <button
              onClick={() => toggleSection("kpis")}
              className="w-full px-8 py-6 flex items-center justify-between cursor-pointer hover:bg-[rgba(255,107,53,0.05)] transition-colors"
            >
              <h1 className="text-2xl text-white">Create calculated KPIs</h1>
              <div className="flex items-center gap-3">
                {saveStatus.kpis === 'saving' ? (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF6B35]" />
                    <span>Saving...</span>
                  </div>
                ) : saveStatus.kpis === 'saved' ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                    <Check className="w-3 h-3 text-emerald-400 -ml-2.5 mt-0.5" />
                    <span className="text-emerald-400">Saved</span>
                  </div>
                ) : null}
                {expandedSections.kpis ? (
                  <ChevronUp className="text-[#9CA3AF]" />
                ) : (
                  <ChevronDown className="text-[#9CA3AF]" />
                )}
              </div>
            </button>

            {expandedSections.kpis && (
              <div className="px-8 pb-8">
                <h2 className="text-xl text-[#9CA3AF] mt-6 mb-2">
                  Define formulas to automatically calculate metrics like CPA,
                  CTR, ROAS from your data columns for{" "}
                  <span className="text-[#FF6B35]">{workspaceName}</span>.
                </h2>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 bg-[#FF6B35] rounded-full"></div>
                    <h3 className="text-sm text-[#6B7280]">
                      Popular formulas for marketing data:
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {kpiFormulas.map((kpi) => (
                      <button
                        key={kpi.id}
                        onClick={() => toggleKPI(kpi.id)}
                        className={`px-5 py-4 rounded-xl text-left transition-all duration-200 ${
                          selectedKPIs.includes(kpi.id)
                            ? "bg-[#FF6B35] border border-[#FF6B35] text-white"
                            : "bg-[#0A0D12] border border-[rgba(255,255,255,0.08)] text-white hover:border-[#FF6B35]"
                        }`}
                        style={
                          selectedKPIs.includes(kpi.id)
                            ? {
                                boxShadow:
                                  "0 0 20px -5px rgba(255, 107, 53, 0.4)",
                              }
                            : {}
                        }
                      >
                        <div className="font-medium">{kpi.name}</div>
                        <div
                          className={`text-sm ${selectedKPIs.includes(kpi.id) ? "text-white/80" : "text-[#6B7280]"}`}
                        >
                          {kpi.fullName}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: AI Hints */}
        <div className="mb-6 w-full">
          <div
            className="w-full bg-[#1A1F2E] rounded-2xl border border-[#2A303C] overflow-hidden"
            style={{
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
            }}
          >
            <button
              onClick={() => toggleSection("ai-hints")}
              className="w-full px-8 py-6 flex items-center justify-between cursor-pointer hover:bg-[rgba(255,107,53,0.05)] transition-colors"
            >
              <h1 className="text-2xl text-white">AI Hints</h1>
              <div className="flex items-center gap-3">
                {saveStatus['ai-hints'] === 'saving' ? (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF6B35]" />
                    <span>Saving...</span>
                  </div>
                ) : saveStatus['ai-hints'] === 'saved' ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                    <Check className="w-3 h-3 text-emerald-400 -ml-2.5 mt-0.5" />
                    <span className="text-emerald-400">Saved</span>
                  </div>
                ) : null}
                {expandedSections["ai-hints"] ? (
                  <ChevronUp className="text-[#9CA3AF]" />
                ) : (
                  <ChevronDown className="text-[#9CA3AF]" />
                )}
              </div>
            </button>

            {expandedSections["ai-hints"] && (
              <div className="px-8 pb-8">
                <p className="text-[#9CA3AF] mt-6 mb-6">
                  Give your AI some additional guidance when uploading data to{" "}
                  <span className="text-[#FF6B35]">{workspaceName}</span>
                </p>

                <textarea
                  value={aiHints}
                  onChange={(e) => setAiHints(e.target.value)}
                  placeholder="E.g., 'Always round percentages to 2 decimal places' or 'Treat blank cells in the revenue column as 0'"
                  rows={6}
                  className="w-full px-4 py-3 bg-[#0A0D12] border border-[rgba(255,255,255,0.08)] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent resize-none"
                />
              </div>
            )}
          </div>
        </div>

        </div>
      </div>
    </div>
  );
}
