import { db } from '../db';
import { systemColumnAliases } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface ColumnAliasDefinition {
  canonicalName: string;
  displayName: string;
  aliases: string[];
  category: string;
  dataType: string;
}

const SYSTEM_COLUMN_ALIASES: ColumnAliasDefinition[] = [
  // Advertising Metrics
  {
    canonicalName: 'ad_spend',
    displayName: 'Ad Spend',
    aliases: ['Cost', 'Total Spend', 'Spend', 'Media Cost', 'Ad Cost', 'Advertising Cost'],
    category: 'advertising',
    dataType: 'currency',
  },
  {
    canonicalName: 'impressions',
    displayName: 'Impressions',
    aliases: ['Impr', 'Imps', 'Views', 'Ad Impressions'],
    category: 'advertising',
    dataType: 'integer',
  },
  {
    canonicalName: 'clicks',
    displayName: 'Clicks',
    aliases: ['Link Clicks', 'All Clicks', 'Total Clicks', 'Ad Clicks'],
    category: 'advertising',
    dataType: 'integer',
  },
  {
    canonicalName: 'ctr',
    displayName: 'CTR',
    aliases: ['Click-Through Rate', 'Click Rate', 'CTR %'],
    category: 'advertising',
    dataType: 'percentage',
  },
  {
    canonicalName: 'cpc',
    displayName: 'CPC',
    aliases: ['Cost Per Click', 'Avg CPC', 'Average CPC'],
    category: 'advertising',
    dataType: 'currency',
  },
  {
    canonicalName: 'cpm',
    displayName: 'CPM',
    aliases: ['Cost Per Mille', 'Cost Per 1000', 'CPM Rate'],
    category: 'advertising',
    dataType: 'currency',
  },
  {
    canonicalName: 'conversions',
    displayName: 'Conversions',
    aliases: ['Conv', 'Actions', 'Completed Actions', 'Goal Completions'],
    category: 'advertising',
    dataType: 'integer',
  },
  {
    canonicalName: 'conversion_rate',
    displayName: 'Conversion Rate',
    aliases: ['Conv Rate', 'CR', 'CVR'],
    category: 'advertising',
    dataType: 'percentage',
  },
  {
    canonicalName: 'roas',
    displayName: 'ROAS',
    aliases: ['Return on Ad Spend', 'Ad Return'],
    category: 'advertising',
    dataType: 'decimal',
  },

  // Date/Time
  {
    canonicalName: 'date',
    displayName: 'Date',
    aliases: ['Day', 'Campaign Date', 'Report Date', 'Reporting Date'],
    category: 'datetime',
    dataType: 'date',
  },
  {
    canonicalName: 'week',
    displayName: 'Week',
    aliases: ['Week Number', 'Week Of'],
    category: 'datetime',
    dataType: 'text',
  },
  {
    canonicalName: 'month',
    displayName: 'Month',
    aliases: ['Reporting Month', 'Month Name'],
    category: 'datetime',
    dataType: 'text',
  },

  // Campaign Info
  {
    canonicalName: 'campaign_name',
    displayName: 'Campaign Name',
    aliases: ['Campaign', 'Campaign Title', 'Ad Campaign'],
    category: 'campaign',
    dataType: 'text',
  },
  {
    canonicalName: 'ad_group',
    displayName: 'Ad Group',
    aliases: ['Ad Set', 'Adset', 'Ad Group Name'],
    category: 'campaign',
    dataType: 'text',
  },
  {
    canonicalName: 'ad_name',
    displayName: 'Ad Name',
    aliases: ['Ad', 'Creative Name', 'Ad Creative'],
    category: 'campaign',
    dataType: 'text',
  },
  {
    canonicalName: 'platform',
    displayName: 'Platform',
    aliases: ['Source', 'Channel', 'Network', 'Ad Platform'],
    category: 'campaign',
    dataType: 'text',
  },

  // Engagement
  {
    canonicalName: 'reach',
    displayName: 'Reach',
    aliases: ['Unique Reach', 'People Reached', 'Unique Users'],
    category: 'engagement',
    dataType: 'integer',
  },
  {
    canonicalName: 'frequency',
    displayName: 'Frequency',
    aliases: ['Avg Frequency', 'Average Frequency'],
    category: 'engagement',
    dataType: 'decimal',
  },
  {
    canonicalName: 'engagement',
    displayName: 'Engagement',
    aliases: ['Engagements', 'Total Engagement', 'Post Engagement'],
    category: 'engagement',
    dataType: 'integer',
  },
  {
    canonicalName: 'likes',
    displayName: 'Likes',
    aliases: ['Post Likes', 'Reactions'],
    category: 'engagement',
    dataType: 'integer',
  },
  {
    canonicalName: 'shares',
    displayName: 'Shares',
    aliases: ['Post Shares', 'Reposts'],
    category: 'engagement',
    dataType: 'integer',
  },
  {
    canonicalName: 'comments',
    displayName: 'Comments',
    aliases: ['Post Comments', 'Replies'],
    category: 'engagement',
    dataType: 'integer',
  },

  // E-commerce
  {
    canonicalName: 'revenue',
    displayName: 'Revenue',
    aliases: ['Sales', 'Total Revenue', 'Gross Revenue', 'Purchase Value'],
    category: 'ecommerce',
    dataType: 'currency',
  },
  {
    canonicalName: 'orders',
    displayName: 'Orders',
    aliases: ['Purchases', 'Transactions', 'Total Orders'],
    category: 'ecommerce',
    dataType: 'integer',
  },
  {
    canonicalName: 'aov',
    displayName: 'AOV',
    aliases: ['Average Order Value', 'Avg Order Value', 'Cart Value'],
    category: 'ecommerce',
    dataType: 'currency',
  },
];

export async function insertSystemAliases(): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const aliasDef of SYSTEM_COLUMN_ALIASES) {
    const existing = await db
      .select()
      .from(systemColumnAliases)
      .where(eq(systemColumnAliases.canonicalName, aliasDef.canonicalName))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(systemColumnAliases)
        .set({
          displayName: aliasDef.displayName,
          aliases: aliasDef.aliases,
          category: aliasDef.category,
          dataType: aliasDef.dataType,
        })
        .where(eq(systemColumnAliases.canonicalName, aliasDef.canonicalName));
      updated++;
    } else {
      await db.insert(systemColumnAliases).values({
        canonicalName: aliasDef.canonicalName,
        displayName: aliasDef.displayName,
        aliases: aliasDef.aliases,
        category: aliasDef.category,
        dataType: aliasDef.dataType,
      });
      inserted++;
    }
  }

  return { inserted, updated };
}

export async function seedColumnAliases(): Promise<void> {
  console.log('Seeding system column aliases...');
  
  try {
    const result = await insertSystemAliases();
    console.log(`System column aliases seeded successfully: ${result.inserted} inserted, ${result.updated} updated`);
  } catch (error) {
    console.error('Failed to seed system column aliases:', error);
    throw error;
  }
}

export { SYSTEM_COLUMN_ALIASES };
