import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  X,
  Lightbulb,
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
  onSave: (section: string, data: any) => Promise<void>;
  onFinish: () => void;
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
  onSave,
  onFinish,
  initialData,
}: RulesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<{
    [key in Section]?: boolean;
  }>({
    rules: true,
    renaming: true,
    kpis: true,
    "ai-hints": true,
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

  const [dirtyState, setDirtyState] = useState<{
    [key in Section]?: boolean;
  }>({});

  const [savingState, setSavingState] = useState<{
    [key in Section]?: boolean;
  }>({});

  const [initialColumnRenames] = useState(JSON.stringify(columnRenames));
  const [initialSelectedKPIs] = useState(JSON.stringify(selectedKPIs));
  const [initialAiHints] = useState(aiHints);
  const [initialCleaningRules] = useState(JSON.stringify(cleaningRules));

  useEffect(() => {
    setDirtyState((prev) => ({
      ...prev,
      renaming: JSON.stringify(columnRenames) !== initialColumnRenames,
    }));
  }, [columnRenames, initialColumnRenames]);

  useEffect(() => {
    setDirtyState((prev) => ({
      ...prev,
      kpis: JSON.stringify(selectedKPIs) !== initialSelectedKPIs,
    }));
  }, [selectedKPIs, initialSelectedKPIs]);

  useEffect(() => {
    setDirtyState((prev) => ({
      ...prev,
      "ai-hints": aiHints !== initialAiHints,
    }));
  }, [aiHints, initialAiHints]);

  useEffect(() => {
    setDirtyState((prev) => ({
      ...prev,
      rules: JSON.stringify(cleaningRules) !== initialCleaningRules,
    }));
  }, [cleaningRules, initialCleaningRules]);

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
    } finally {
      setSavingState((prev) => ({ ...prev, [section]: false }));
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0A0D12] p-6 md:p-12">
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(255, 107, 53, 0.15) 0%, rgba(10, 13, 18, 0) 50%)",
            filter: "blur(120px)",
          }}
        />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Section 1: Rules for your data */}
        <div className="mb-6">
          <div
            className="bg-[#1A1F2E] rounded-2xl border border-[#2A303C] overflow-hidden"
            style={{
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
            }}
          >
            <button
              onClick={() => toggleSection("rules")}
              className="w-full px-8 py-6 flex items-center justify-between cursor-pointer hover:bg-[rgba(255,107,53,0.05)] transition-colors"
            >
              <h1 className="text-2xl text-white">Rules for your data</h1>
              {expandedSections.rules ? (
                <ChevronUp className="text-[#9CA3AF]" />
              ) : (
                <ChevronDown className="text-[#9CA3AF]" />
              )}
            </button>

            {expandedSections.rules && (
              <div className="px-8 pb-8">
                <h2 className="text-xl text-[#9CA3AF] mt-6 mb-2">
                  When data is uploaded to{" "}
                  <span className="relative inline">
                    <button
                      onClick={() =>
                        setShowWorkspaceDropdown(!showWorkspaceDropdown)
                      }
                      className="text-xl text-[#FF6B35] hover:text-[#FF8C5E] transition-colors inline-flex items-center gap-1"
                    >
                      {workspaceName}
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${showWorkspaceDropdown ? "rotate-180" : ""}`}
                      />
                    </button>
                    {showWorkspaceDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowWorkspaceDropdown(false)}
                        />
                        <div className="absolute top-full left-0 mt-2 bg-[#1A1F2E] border border-[#2A303C] rounded-xl overflow-hidden z-20 min-w-[200px] shadow-xl">
                          {workspaces.map((workspace) => (
                            <button
                              key={workspace.id}
                              onClick={() => selectWorkspace(workspace.id)}
                              className={`w-full px-4 py-3 text-left transition-colors ${
                                workspace.id === workspaceId
                                  ? "bg-[#FF6B35] text-white"
                                  : "text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-[#FF6B35]"
                              }`}
                            >
                              {workspace.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </span>, how would you like it to be processed?
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
        <div className="mb-6">
          <div
            className="bg-[#1A1F2E] rounded-2xl border border-[#2A303C] overflow-hidden"
            style={{
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
            }}
          >
            <button
              onClick={() => toggleSection("renaming")}
              className="w-full px-8 py-6 flex items-center justify-between cursor-pointer hover:bg-[rgba(255,107,53,0.05)] transition-colors"
            >
              <h1 className="text-2xl text-white">Column Renaming</h1>
              {expandedSections.renaming ? (
                <ChevronUp className="text-[#9CA3AF]" />
              ) : (
                <ChevronDown className="text-[#9CA3AF]" />
              )}
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
        <div className="mb-6">
          <div
            className="bg-[#1A1F2E] rounded-2xl border border-[#2A303C] overflow-hidden"
            style={{
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
            }}
          >
            <button
              onClick={() => toggleSection("kpis")}
              className="w-full px-8 py-6 flex items-center justify-between cursor-pointer hover:bg-[rgba(255,107,53,0.05)] transition-colors"
            >
              <h1 className="text-2xl text-white">Create calculated KPIs</h1>
              {expandedSections.kpis ? (
                <ChevronUp className="text-[#9CA3AF]" />
              ) : (
                <ChevronDown className="text-[#9CA3AF]" />
              )}
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
        <div className="mb-6">
          <div
            className="bg-[#1A1F2E] rounded-2xl border border-[#2A303C] overflow-hidden"
            style={{
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
            }}
          >
            <button
              onClick={() => toggleSection("ai-hints")}
              className="w-full px-8 py-6 flex items-center justify-between cursor-pointer hover:bg-[rgba(255,107,53,0.05)] transition-colors"
            >
              <h1 className="text-2xl text-white">AI Hints</h1>
              {expandedSections["ai-hints"] ? (
                <ChevronUp className="text-[#9CA3AF]" />
              ) : (
                <ChevronDown className="text-[#9CA3AF]" />
              )}
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

        {/* Finish Button - saves all sections */}
        <div className="flex justify-center mt-8 mb-12">
          <button
            onClick={async () => {
              // Save all sections that have changes
              const sectionsToSave: Section[] = ['rules', 'renaming', 'kpis', 'ai-hints'];
              for (const section of sectionsToSave) {
                await handleSaveSection(section);
              }
              onFinish();
            }}
            className="px-12 py-4 bg-[#FF6B35] text-white rounded-full hover:scale-105 transition-transform duration-200 text-lg font-medium whitespace-nowrap"
            style={{
              boxShadow: "0 0 40px -10px rgba(255, 107, 53, 0.5)",
            }}
          >
            Finish Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
