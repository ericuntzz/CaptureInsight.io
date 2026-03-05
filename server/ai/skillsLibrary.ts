import { db } from "../db";
import { agentSkills } from "../../shared/schema";
import { eq } from "drizzle-orm";

export interface BuiltinSkillDef {
  name: string;
  description: string;
  category: 'analysis' | 'monitoring' | 'reporting' | 'cleaning';
  config: Record<string, any>;
  promptTemplate: string;
}

export const BUILTIN_SKILLS: BuiltinSkillDef[] = [
  {
    name: 'Trend Detection',
    description: 'Identifies upward/downward trends across time-series data, highlights acceleration and deceleration patterns.',
    category: 'analysis',
    config: { minDataPoints: 5, trendThreshold: 0.05 },
    promptTemplate: `Analyze the following data for trends over time.

DATA:
{{data}}

Provide:
1. Overall trend direction (increasing/decreasing/stable) with confidence level
2. Rate of change and whether it's accelerating or decelerating
3. Any inflection points or trend reversals
4. Statistical significance assessment
5. Short-term forecast based on current trajectory

Format your response as a clear, actionable summary with specific numbers and percentages.`,
  },
  {
    name: 'Anomaly Detection',
    description: 'Flags statistical outliers in metrics with configurable sensitivity threshold.',
    category: 'monitoring',
    config: { sensitivityStdDevs: 2, minSampleSize: 10 },
    promptTemplate: `Analyze the following data for anomalies and outliers.

DATA:
{{data}}

SENSITIVITY: {{config.sensitivityStdDevs}} standard deviations

For each anomaly found, provide:
1. The metric and value that is anomalous
2. Expected range and how far outside it the value falls
3. Whether it's a positive anomaly (opportunity) or negative (problem)
4. Possible causes
5. Recommended action

Format as a prioritized list from most to least severe.`,
  },
  {
    name: 'KPI Health Monitor',
    description: 'Tracks configured KPIs against targets and alerts when metrics fall outside acceptable ranges.',
    category: 'monitoring',
    config: { warningThreshold: 0.9, criticalThreshold: 0.75 },
    promptTemplate: `Evaluate the health of KPIs in the following data.

DATA:
{{data}}

WARNING THRESHOLD: {{config.warningThreshold}} (flag if below this ratio of target)
CRITICAL THRESHOLD: {{config.criticalThreshold}} (alert if below this ratio)

For each KPI found:
1. Current value vs. implied target/benchmark
2. Health status: Healthy / Warning / Critical
3. Trend direction over available time period
4. Root cause analysis for any underperforming KPIs
5. Specific recommendations to improve

Provide an executive summary at the top, then detailed KPI-by-KPI breakdown.`,
  },
  {
    name: 'Weekly Summary',
    description: 'Generates a concise narrative summary of the week\'s data changes, wins, and concerns.',
    category: 'reporting',
    config: { focusAreas: ['performance', 'changes', 'risks'] },
    promptTemplate: `Generate a weekly summary report from the following data.

DATA:
{{data}}

Structure the summary as:

**This Week's Highlights**
- Top 3 wins or positive developments

**Key Changes**
- Notable metric movements with specific numbers
- New patterns or shifts

**Areas of Concern**
- Metrics trending negatively
- Potential risks identified

**Recommended Actions**
- Prioritized list of suggested next steps

Keep the tone professional and concise. Use specific numbers, not vague descriptions.`,
  },
  {
    name: 'Competitor Benchmark',
    description: 'Compares metrics against industry benchmarks or user-defined competitor data.',
    category: 'analysis',
    config: { industry: 'general', benchmarkSource: 'industry_average' },
    promptTemplate: `Compare the following data against industry benchmarks.

DATA:
{{data}}

INDUSTRY CONTEXT: {{config.industry}}

For each key metric:
1. Current value
2. Industry benchmark (provide common benchmarks for the metric type)
3. Performance relative to benchmark (above/below/at par)
4. Percentile estimate
5. Specific actions to close any gaps

Provide an overall competitive position assessment and strategic recommendations.`,
  },
  {
    name: 'Data Quality Guard',
    description: 'Monitors incoming data for quality issues including missing values, format inconsistencies, and duplicate rows.',
    category: 'cleaning',
    config: { missingValueThreshold: 0.05, duplicateCheck: true },
    promptTemplate: `Perform a data quality audit on the following data.

DATA:
{{data}}

Check for:
1. **Missing Values**: Identify columns with missing/null values and their percentage
2. **Format Inconsistencies**: Mixed formats within columns (dates, currencies, etc.)
3. **Duplicate Rows**: Exact or near-duplicate entries
4. **Outlier Values**: Values that seem like data entry errors
5. **Type Mismatches**: Text in numeric columns, etc.

For each issue found:
- Severity: Critical / Warning / Info
- Affected rows/columns
- Recommended fix
- Impact on analysis if left unfixed

Provide an overall quality score (0-100) with justification.`,
  },
  {
    name: 'Auto-Categorizer',
    description: 'Automatically categorizes and tags data rows based on patterns and content.',
    category: 'cleaning',
    config: { maxCategories: 10, confidenceThreshold: 0.7 },
    promptTemplate: `Analyze the following data and suggest categorization/tagging for each row.

DATA:
{{data}}

MAX CATEGORIES: {{config.maxCategories}}

1. Identify natural groupings in the data
2. Suggest category names that are meaningful and actionable
3. Assign each row to a category with a confidence score
4. Identify any rows that don't fit neatly into categories
5. Suggest a tagging taxonomy for further organization

Present results as a summary of categories found, then a mapping of rows to categories.`,
  },
  {
    name: 'Executive Brief',
    description: 'Produces C-suite-ready bullet points highlighting the most important changes and recommendations.',
    category: 'reporting',
    config: { maxBulletPoints: 5, audienceLevel: 'executive' },
    promptTemplate: `Create an executive brief from the following data.

DATA:
{{data}}

Requirements:
- Maximum {{config.maxBulletPoints}} bullet points
- Each bullet must be actionable and include specific numbers
- Lead with the most impactful finding
- Include one forward-looking recommendation
- Use business language, not technical jargon

Format:
**Bottom Line**: One sentence summary

**Key Points**:
- [Bullet points]

**Recommended Action**: One clear next step with expected impact`,
  },
];

/**
 * Seeds built-in skills into the database. Idempotent — skips skills that already exist by name.
 */
export async function seedBuiltinSkills(): Promise<void> {
  console.log('[Skills] Checking built-in skills...');

  for (const skill of BUILTIN_SKILLS) {
    const [existing] = await db
      .select()
      .from(agentSkills)
      .where(eq(agentSkills.name, skill.name))
      .limit(1);

    if (!existing) {
      await db.insert(agentSkills).values({
        name: skill.name,
        description: skill.description,
        category: skill.category,
        skillType: 'builtin',
        config: skill.config,
        promptTemplate: skill.promptTemplate,
        isSystem: true,
        createdBy: null,
      });
      console.log(`[Skills] Seeded: ${skill.name}`);
    }
  }

  console.log('[Skills] Built-in skills check complete.');
}
