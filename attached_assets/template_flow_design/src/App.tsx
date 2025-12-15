import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  X,
  Lightbulb,
  Calculator,
} from "lucide-react";
import { CleaningPipeline } from "./components/CleaningPipeline";

type Step =
  | "initial"
  | "rules"
  | "renaming"
  | "kpis"
  | "ai-hints";

interface ColumnRename {
  id: string;
  from: string;
  to: string;
  aliases: string[];
  showAliases: boolean;
  newAlias: string;
  suggestedAliases: string[];
}

interface WorkspaceConfig {
  id: string;
  name: string;
  rules: string[];
  columnRenames: ColumnRename[];
  selectedKPIs: string[];
  aiHints: string;
}

export default function App() {
  const [currentStep, setCurrentStep] =
    useState<Step>("initial");
  const [completedSteps, setCompletedSteps] = useState<Step[]>(
    [],
  );
  const [reachedSteps, setReachedSteps] = useState<Step[]>([
    "initial",
  ]);
  const [expandedSections, setExpandedSections] = useState<{
    [key in Step]?: boolean;
  }>({
    rules: true,
    renaming: true,
    kpis: true,
    "ai-hints": true,
  });

  // Workspace management
  const [workspaces, setWorkspaces] = useState<
    WorkspaceConfig[]
  >([
    {
      id: "1",
      name: "My Workspace",
      rules: [
        "Remove duplicates",
        "Trim whitespace",
        "Convert to lowercase",
      ],
      columnRenames: [
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
      ],
      selectedKPIs: [],
      aiHints: "",
    },
    {
      id: "2",
      name: "Marketing Team",
      rules: [],
      columnRenames: [
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
      ],
      selectedKPIs: [],
      aiHints: "",
    },
    {
      id: "3",
      name: "Sales Dashboard",
      rules: [],
      columnRenames: [
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
      ],
      selectedKPIs: [],
      aiHints: "",
    },
  ]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] =
    useState<string>("1");
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] =
    useState(false);

  const selectedWorkspace =
    workspaces.find((w) => w.id === selectedWorkspaceId) ||
    workspaces[0];
  const workspaceName = selectedWorkspace.name;

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
    setWorkspaces(
      workspaces.map((ws) =>
        ws.id === selectedWorkspaceId
          ? {
              ...ws,
              selectedKPIs: ws.selectedKPIs.includes(kpiId)
                ? ws.selectedKPIs.filter((id) => id !== kpiId)
                : [...ws.selectedKPIs, kpiId],
            }
          : ws,
      ),
    );
  };

  const handleInitialYes = () => {
    setCurrentStep("rules");
    setReachedSteps(["initial", "rules"]);
    setCompletedSteps([]);
  };

  const handleRulesNext = () => {
    setCompletedSteps([...completedSteps, "rules"]);
    setCurrentStep("renaming");
    setReachedSteps(["initial", "rules", "renaming"]);
    setExpandedSections((prev) => ({
      ...prev,
      rules: false,
      renaming: true,
    }));
  };

  const handleRenamingNext = () => {
    setCompletedSteps([...completedSteps, "renaming"]);
    setCurrentStep("kpis");
    setReachedSteps(["initial", "rules", "renaming", "kpis"]);
    setExpandedSections((prev) => ({
      ...prev,
      renaming: false,
      kpis: true,
    }));
  };

  const handleKPIsNext = () => {
    setCompletedSteps([...completedSteps, "kpis"]);
    setCurrentStep("ai-hints");
    setReachedSteps([
      "initial",
      "rules",
      "renaming",
      "kpis",
      "ai-hints",
    ]);
    setExpandedSections((prev) => ({
      ...prev,
      kpis: false,
      "ai-hints": true,
    }));
  };

  const handleFinish = () => {
    alert("Configuration completed!");
  };

  const selectWorkspace = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setShowWorkspaceDropdown(false);
  };

  const columnRenames = selectedWorkspace.columnRenames;
  const selectedKPIs = selectedWorkspace.selectedKPIs;
  const aiHints = selectedWorkspace.aiHints;

  const addRename = () => {
    const newId = (columnRenames.length + 1).toString();
    setWorkspaces(
      workspaces.map((ws) =>
        ws.id === selectedWorkspaceId
          ? {
              ...ws,
              columnRenames: [
                ...ws.columnRenames,
                {
                  id: newId,
                  from: "",
                  to: "",
                  aliases: [],
                  showAliases: false,
                  newAlias: "",
                  suggestedAliases: [],
                },
              ],
            }
          : ws,
      ),
    );
  };

  const removeRename = (id: string) => {
    if (columnRenames.length > 1) {
      setWorkspaces(
        workspaces.map((ws) =>
          ws.id === selectedWorkspaceId
            ? {
                ...ws,
                columnRenames: ws.columnRenames.filter(
                  (rename) => rename.id !== id,
                ),
              }
            : ws,
        ),
      );
    }
  };

  const updateRename = (
    id: string,
    field: "from" | "to" | "newAlias",
    value: string,
  ) => {
    setWorkspaces(
      workspaces.map((ws) =>
        ws.id === selectedWorkspaceId
          ? {
              ...ws,
              columnRenames: ws.columnRenames.map((rename) =>
                rename.id === id
                  ? { ...rename, [field]: value }
                  : rename,
              ),
            }
          : ws,
      ),
    );
  };

  const toggleAliases = (id: string) => {
    setWorkspaces(
      workspaces.map((ws) =>
        ws.id === selectedWorkspaceId
          ? {
              ...ws,
              columnRenames: ws.columnRenames.map((rename) =>
                rename.id === id
                  ? {
                      ...rename,
                      showAliases: !rename.showAliases,
                    }
                  : rename,
              ),
            }
          : ws,
      ),
    );
  };

  const addAlias = (id: string) => {
    setWorkspaces(
      workspaces.map((ws) =>
        ws.id === selectedWorkspaceId
          ? {
              ...ws,
              columnRenames: ws.columnRenames.map((rename) =>
                rename.id === id
                  ? {
                      ...rename,
                      aliases: [
                        ...rename.aliases,
                        rename.newAlias,
                      ],
                      newAlias: "",
                    }
                  : rename,
              ),
            }
          : ws,
      ),
    );
  };

  const removeAlias = (id: string, alias: string) => {
    setWorkspaces(
      workspaces.map((ws) =>
        ws.id === selectedWorkspaceId
          ? {
              ...ws,
              columnRenames: ws.columnRenames.map((rename) =>
                rename.id === id
                  ? {
                      ...rename,
                      aliases: rename.aliases.filter(
                        (a) => a !== alias,
                      ),
                    }
                  : rename,
              ),
            }
          : ws,
      ),
    );
  };

  const addSuggestedAlias = (
    id: string,
    suggestedAlias: string,
  ) => {
    setWorkspaces(
      workspaces.map((ws) =>
        ws.id === selectedWorkspaceId
          ? {
              ...ws,
              columnRenames: ws.columnRenames.map((rename) =>
                rename.id === id
                  ? {
                      ...rename,
                      aliases: [
                        ...rename.aliases,
                        suggestedAlias,
                      ],
                      suggestedAliases:
                        rename.suggestedAliases.filter(
                          (a) => a !== suggestedAlias,
                        ),
                    }
                  : rename,
              ),
            }
          : ws,
      ),
    );
  };

  const updateAiHints = (value: string) => {
    setWorkspaces(
      workspaces.map((ws) =>
        ws.id === selectedWorkspaceId
          ? { ...ws, aiHints: value }
          : ws,
      ),
    );
  };

  const toggleSection = (step: Step) => {
    setExpandedSections((prev) => ({
      ...prev,
      [step]: !prev[step],
    }));
  };

  return (
    <div className="min-h-screen bg-[#0A0D12] p-6 md:p-12">
      {/* Ambient Glow Effect */}
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
        {/* Step 1: Initial Question */}
        {currentStep === "initial" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <button
              onClick={handleInitialYes}
              className="px-12 py-6 bg-[#FF6B35] text-white rounded-full hover:scale-105 transition-transform duration-200 text-3xl"
              style={{
                boxShadow:
                  "0 0 40px -10px rgba(255, 107, 53, 0.5)",
              }}
            >
              Create rules for your data?
            </button>
          </div>
        )}

        {/* Step 2: Rules for your data */}
        {reachedSteps.includes("rules") &&
          currentStep !== "initial" && (
            <div className="mb-6">
              <div
                className="bg-[#1A1F2E] rounded-2xl border border-[#2A303C] overflow-hidden"
                style={{
                  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
                }}
              >
                {/* Header */}
                <button
                  onClick={() => toggleSection("rules")}
                  className="w-full px-8 py-6 flex items-center justify-between cursor-pointer hover:bg-[rgba(255,107,53,0.05)] transition-colors"
                >
                  <h1 className="text-2xl">
                    Rules for your data
                  </h1>
                  {expandedSections.rules ? (
                    <ChevronUp className="text-[#9CA3AF]" />
                  ) : (
                    <ChevronDown className="text-[#9CA3AF]" />
                  )}
                </button>

                {/* Content */}
                {expandedSections.rules && (
                  <div className="px-8 pb-8 border-t border-[#2A303C]">
                    <h2 className="text-xl text-[#9CA3AF] mt-6 mb-2">
                      When data is uploaded to{" "}
                      <div className="inline-block relative">
                        <button
                          onClick={() =>
                            setShowWorkspaceDropdown(
                              !showWorkspaceDropdown,
                            )
                          }
                          className="text-[#FF6B35] hover:text-[#FF8C5E] transition-colors inline-flex items-center gap-1"
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
                              onClick={() =>
                                setShowWorkspaceDropdown(false)
                              }
                            />
                            <div className="absolute top-full left-0 mt-2 bg-[#1A1F2E] border border-[#2A303C] rounded-xl overflow-hidden z-20 min-w-[200px] shadow-xl">
                              {workspaces.map((workspace) => (
                                <button
                                  key={workspace.id}
                                  onClick={() =>
                                    selectWorkspace(
                                      workspace.id,
                                    )
                                  }
                                  className={`w-full px-4 py-3 text-left transition-colors ${
                                    workspace.id ===
                                    selectedWorkspaceId
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
                      </div>
                      , how would you like it to be processed?
                    </h2>
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-1 h-4 bg-[#FF6B35] rounded-full"></div>
                      <p className="text-sm italic text-[#6B7280]">
                        Rule will be applied to all columns
                      </p>
                    </div>

                    <CleaningPipeline />

                    {currentStep === "rules" && (
                      <button
                        onClick={handleRulesNext}
                        className="mt-8 px-8 py-3 bg-[#FF6B35] text-white rounded-full hover:scale-105 transition-transform duration-200"
                        style={{
                          boxShadow:
                            "0 0 40px -10px rgba(255, 107, 53, 0.5)",
                        }}
                      >
                        Next
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Step 3: Column Renaming */}
        {reachedSteps.includes("renaming") &&
          currentStep !== "initial" && (
            <div className="mb-6">
              <div
                className="bg-[#1A1F2E] rounded-2xl border border-[#2A303C] overflow-hidden"
                style={{
                  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
                }}
              >
                {/* Header */}
                <button
                  onClick={() => toggleSection("renaming")}
                  className="w-full px-8 py-6 flex items-center justify-between cursor-pointer hover:bg-[rgba(255,107,53,0.05)] transition-colors"
                >
                  <h1 className="text-2xl">Column Renaming</h1>
                  {expandedSections.renaming ? (
                    <ChevronUp className="text-[#9CA3AF]" />
                  ) : (
                    <ChevronDown className="text-[#9CA3AF]" />
                  )}
                </button>

                {/* Content */}
                {expandedSections.renaming && (
                  <div className="px-8 pb-8 border-t border-[#2A303C]">
                    <h2 className="text-xl text-[#9CA3AF] mt-6 mb-2">
                      Are there any column headers that you
                      would like to be renamed when you upload
                      data to{" "}
                      <span className="text-[#FF6B35]">
                        {workspaceName}
                      </span>
                      ?
                    </h2>
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-1 h-4 bg-[#FF6B35] rounded-full"></div>
                      <h3 className="text-sm text-[#6B7280]">
                        I.e. change any columns that say "CTR"
                        to "Click Through Rate"
                      </h3>
                    </div>

                    <div className="space-y-4 mb-6">
                      {columnRenames.map((rename, index) => (
                        <div key={rename.id}>
                          {/* Main Rename Row */}
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
                                    updateRename(
                                      rename.id,
                                      "from",
                                      e.target.value,
                                    )
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
                                    updateRename(
                                      rename.id,
                                      "to",
                                      e.target.value,
                                    )
                                  }
                                  placeholder='e.g. "Click Through Rate"'
                                  className="w-full px-4 py-3 bg-[#0A0D12] border border-[rgba(255,255,255,0.08)] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
                                />
                              </div>
                            </div>
                            {columnRenames.length > 1 && (
                              <button
                                onClick={() =>
                                  removeRename(rename.id)
                                }
                                className="mt-8 p-3 text-[#9CA3AF] hover:text-[#FF6B35] hover:bg-[#0A0D12] rounded-xl transition-colors"
                              >
                                <Trash2 size={20} />
                              </button>
                            )}
                          </div>

                          {/* Column Aliases Section - Subtle Design */}
                          <div className="ml-0 mt-3">
                            <button
                              onClick={() =>
                                toggleAliases(rename.id)
                              }
                              className="flex items-center gap-2 text-xs text-[#6B7280] hover:text-[#9CA3AF] transition-colors"
                            >
                              <Lightbulb size={14} />
                              <span>
                                Column Aliases (optional)
                              </span>
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
                                    Help AI recognize this
                                    column even if the name
                                    changes in future uploads
                                  </p>
                                </div>

                                {/* Alias Tags */}
                                {rename.aliases.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {rename.aliases.map(
                                      (alias, idx) => (
                                        <div
                                          key={idx}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1F2E] border border-[rgba(255,255,255,0.08)] rounded-full text-sm text-[#9CA3AF]"
                                        >
                                          <span>{alias}</span>
                                          <button
                                            onClick={() =>
                                              removeAlias(
                                                rename.id,
                                                alias,
                                              )
                                            }
                                            className="hover:text-[#FF6B35] transition-colors"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}

                                {/* Add Alias Input */}
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={rename.newAlias}
                                    onChange={(e) =>
                                      updateRename(
                                        rename.id,
                                        "newAlias",
                                        e.target.value,
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
                                      if (
                                        rename.newAlias.trim()
                                      ) {
                                        addAlias(rename.id);
                                      }
                                    }}
                                    disabled={
                                      !rename.newAlias.trim()
                                    }
                                    className="px-4 py-2 bg-[#1A1F2E] border border-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#9CA3AF] hover:text-[#FF6B35] hover:border-[#FF6B35] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Add
                                  </button>
                                </div>

                                {/* Suggested Aliases */}
                                {rename.suggestedAliases
                                  .length > 0 && (
                                  <div className="mt-4">
                                    <h4 className="text-xs text-[#6B7280] mb-2">
                                      Suggested aliases:
                                    </h4>
                                    <div className="flex flex-wrap gap-3">
                                      {rename.suggestedAliases.map(
                                        (
                                          suggestedAlias,
                                          idx,
                                        ) => (
                                          <button
                                            key={idx}
                                            onClick={() =>
                                              addSuggestedAlias(
                                                rename.id,
                                                suggestedAlias,
                                              )
                                            }
                                            className="flex items-center gap-1.5 text-sm text-[#9CA3AF] hover:text-[#FF6B35] transition-colors"
                                          >
                                            <Plus size={14} />
                                            {suggestedAlias}
                                          </button>
                                        ),
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

                    {currentStep === "renaming" && (
                      <button
                        onClick={handleRenamingNext}
                        className="mt-8 px-8 py-3 bg-[#FF6B35] text-white rounded-full hover:scale-105 transition-transform duration-200"
                        style={{
                          boxShadow:
                            "0 0 40px -10px rgba(255, 107, 53, 0.5)",
                        }}
                      >
                        Next
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Step 4: Create Calculated KPIs */}
        {reachedSteps.includes("kpis") &&
          currentStep !== "initial" && (
            <div className="mb-6">
              <div
                className="bg-[#1A1F2E] rounded-2xl border border-[#2A303C] overflow-hidden"
                style={{
                  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
                }}
              >
                {/* Header */}
                <button
                  onClick={() => toggleSection("kpis")}
                  className="w-full px-8 py-6 flex items-center justify-between cursor-pointer hover:bg-[rgba(255,107,53,0.05)] transition-colors"
                >
                  <h1 className="text-2xl">
                    Create calculated KPIs
                  </h1>
                  {expandedSections.kpis ? (
                    <ChevronUp className="text-[#9CA3AF]" />
                  ) : (
                    <ChevronDown className="text-[#9CA3AF]" />
                  )}
                </button>

                {/* Content */}
                {expandedSections.kpis && (
                  <div className="px-8 pb-8 border-t border-[#2A303C]">
                    <h2 className="text-xl text-[#9CA3AF] mt-6 mb-2">
                      Define formulas to automatically calculate
                      metrics like CPA, CTR, ROAS from your data
                      columns for{" "}
                      <span className="text-[#FF6B35]">
                        {workspaceName}
                      </span>
                      .
                    </h2>

                    {/* Popular formulas section */}
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
                            <div className="font-medium">
                              {kpi.name}
                            </div>
                            <div
                              className={`text-sm ${selectedKPIs.includes(kpi.id) ? "text-white/80" : "text-[#6B7280]"}`}
                            >
                              {kpi.fullName}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {currentStep === "kpis" && (
                      <button
                        onClick={handleKPIsNext}
                        className="mt-8 px-8 py-3 bg-[#FF6B35] text-white rounded-full hover:scale-105 transition-transform duration-200"
                        style={{
                          boxShadow:
                            "0 0 40px -10px rgba(255, 107, 53, 0.5)",
                        }}
                      >
                        Next
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Step 5: AI Hints */}
        {reachedSteps.includes("ai-hints") &&
          currentStep !== "initial" && (
            <div className="mb-6">
              <div
                className="bg-[#1A1F2E] rounded-2xl border border-[#2A303C] overflow-hidden"
                style={{
                  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
                }}
              >
                {/* Header */}
                <button
                  onClick={() => toggleSection("ai-hints")}
                  className="w-full px-8 py-6 flex items-center justify-between cursor-pointer hover:bg-[rgba(255,107,53,0.05)] transition-colors"
                >
                  <h1 className="text-2xl">AI Hints</h1>
                  {expandedSections["ai-hints"] ? (
                    <ChevronUp className="text-[#9CA3AF]" />
                  ) : (
                    <ChevronDown className="text-[#9CA3AF]" />
                  )}
                </button>

                {/* Content */}
                {expandedSections["ai-hints"] && (
                  <div className="px-8 pb-8 border-t border-[#2A303C]">
                    <p className="text-[#9CA3AF] mt-6 mb-6">
                      Give your AI some additional guidance when
                      uploading data to{" "}
                      <span className="text-[#FF6B35]">
                        {workspaceName}
                      </span>
                    </p>

                    <textarea
                      value={aiHints}
                      onChange={(e) =>
                        updateAiHints(e.target.value)
                      }
                      placeholder="E.g., 'Always round percentages to 2 decimal places' or 'Treat blank cells in the revenue column as 0'"
                      rows={6}
                      className="w-full px-4 py-3 bg-[#0A0D12] border border-[rgba(255,255,255,0.08)] rounded-xl text-white placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent resize-none"
                    />

                    {currentStep === "ai-hints" && (
                      <button
                        onClick={handleFinish}
                        className="mt-8 px-8 py-3 bg-[#FF6B35] text-white rounded-full hover:scale-105 transition-transform duration-200"
                        style={{
                          boxShadow:
                            "0 0 40px -10px rgba(255, 107, 53, 0.5)",
                        }}
                      >
                        Finish
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}