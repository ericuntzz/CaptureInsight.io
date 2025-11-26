// Types and mock data for Insights system

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  createdBy: string;
  spaceId?: string; // Added: Space association for proper scoping
}

export interface InsightComment {
  id: string;
  content: string; // Changed from 'content' to match the UI
  author: string;
  createdAt: Date; // Changed from 'createdAt' to match the UI
  mentions: string[]; // User IDs of @mentioned users
  parentId?: string; // For threaded replies
  // UI compatibility aliases
  text?: string; // Alias for content
  timestamp?: Date; // Alias for createdAt
}

export interface InsightSource {
  id: string;
  type: 'chat' | 'capture' | 'datasheet' | 'changelog'; // Fixed typo: changlog → changelog
  name: string;
  url: string;
  chatBubbleId?: string; // For linking back to specific chat messages
}

export interface Insight {
  id: string;
  title: string;
  summary: string; // AI-generated or user-edited
  status: 'Open' | 'Archived';
  priority?: 'High' | 'Medium' | 'Low'; // Added: Priority field for insights
  dateCreated: Date;
  createdBy: string;
  tags: string[]; // Array of tag IDs
  sources: InsightSource[];
  comments: InsightComment[];
  folderId?: string; // Optional folder association
  spaceId?: string; // Added: Space association
}

// Predefined colors for tags (auto-assigned, user can change)
export const TAG_COLORS = [
  '#FF6B35', // Primary Orange
  '#4ECDC4', // Teal
  '#FFE66D', // Yellow
  '#A8E6CF', // Mint Green
  '#FF8B94', // Pink
  '#B4A7D6', // Lavender
  '#FFD3B6', // Peach
  '#88D8B0', // Seafoam
  '#FFA07A', // Light Coral
  '#98D8C8', // Aquamarine
];

// Mock tags
export const mockTags: Tag[] = [
  {
    id: 'tag-1',
    name: 'Revenue Growth',
    color: '#FF6B35',
    createdAt: new Date('2025-01-10'),
    createdBy: 'Sarah Chen',
    spaceId: 'space-1', // Added: Associate with Q4 Marketing Analysis space
  },
  {
    id: 'tag-2',
    name: 'Cost Optimization',
    color: '#4ECDC4',
    createdAt: new Date('2025-01-12'),
    createdBy: 'Mike Johnson',
    spaceId: 'space-1',
  },
  {
    id: 'tag-3',
    name: 'Customer Acquisition',
    color: '#FFE66D',
    createdAt: new Date('2025-01-15'),
    createdBy: 'Sarah Chen',
    spaceId: 'space-1',
  },
  {
    id: 'tag-4',
    name: 'Ad Performance',
    color: '#A8E6CF',
    createdAt: new Date('2025-01-18'),
    createdBy: 'Alex Rivera',
    spaceId: 'space-1',
  },
  {
    id: 'tag-5',
    name: 'Q4 Planning',
    color: '#FF8B94',
    createdAt: new Date('2025-01-20'),
    createdBy: 'Sarah Chen',
    spaceId: 'space-1',
  },
];

// Mock insights
export const mockInsights: Insight[] = [
  {
    id: 'insight-1',
    title: 'Facebook Ads CAC Spike in May',
    summary: 'Customer Acquisition Cost for Facebook Ads increased by 67% from January to June, with the sharpest increase occurring in May. This correlates with higher ad spend but lower conversion rates. Recommendation: Review targeting strategy and creative performance.',
    status: 'Open',
    priority: 'High', // Added: High priority due to significant cost increase
    dateCreated: new Date('2025-11-10'),
    createdBy: 'Sarah Chen',
    tags: ['tag-2', 'tag-3', 'tag-4'],
    sources: [
      {
        id: 'source-1',
        type: 'chat',
        name: 'CAC Analysis Chat',
        url: '/ai-chat',
        chatBubbleId: 'chat-msg-123',
      },
      {
        id: 'source-2',
        type: 'datasheet',
        name: 'Ad Spend Data Q2',
        url: '/data/sheet-1',
      },
    ],
    comments: [
      {
        id: 'comment-1',
        content: 'I noticed this too. We changed our audience targeting in May which might explain the drop in conversion rates.',
        author: 'Mike Johnson',
        createdAt: new Date('2025-11-11'),
        mentions: [],
      },
      {
        id: 'comment-2',
        content: '@Mike Johnson Can you share the specific targeting changes? We should document this for future reference.',
        author: 'Sarah Chen',
        createdAt: new Date('2025-11-11'),
        mentions: ['Mike Johnson'],
        parentId: 'comment-1',
      },
    ],
    folderId: 'folder-2',
    spaceId: 'space-1', // Added: Q4 Marketing Analysis space
  },
  {
    id: 'insight-2',
    title: 'Google Ads Outperforming Facebook',
    summary: 'Google Ads shows 6.9x ROI compared to Facebook Ads at 2.3x ROI this quarter. Google Ads maintains stable performance with lower CPC ($2.45) and higher conversion rates (4.8%). Budget reallocation recommended.',
    status: 'Open',
    priority: 'Medium', // Added: Important but not urgent
    dateCreated: new Date('2025-11-12'),
    createdBy: 'Alex Rivera',
    tags: ['tag-1', 'tag-4'],
    sources: [
      {
        id: 'source-3',
        type: 'chat',
        name: 'ROI Comparison Chat',
        url: '/ai-chat',
        chatBubbleId: 'chat-msg-456',
      },
      {
        id: 'source-4',
        type: 'datasheet',
        name: 'Google Ads Performance',
        url: '/data/sheet-2',
      },
      {
        id: 'source-5',
        type: 'capture',
        name: 'Facebook Ads Dashboard Screenshot',
        url: '/capture/cap-789',
      },
    ],
    comments: [],
    folderId: 'folder-2',
    spaceId: 'space-1',
  },
  {
    id: 'insight-3',
    title: 'Organic Search Leading Revenue',
    summary: 'Organic search generated $425,000 (34% of total revenue) in Q4 with the highest ROI at 12:1. This channel requires minimal ongoing investment and shows consistent growth. Continue SEO optimization efforts.',
    status: 'Archived',
    priority: 'Low', // Added: Closed and informational
    dateCreated: new Date('2025-11-08'),
    createdBy: 'Sarah Chen',
    tags: ['tag-1', 'tag-3'],
    sources: [
      {
        id: 'source-6',
        type: 'datasheet',
        name: 'Revenue by Channel Q4',
        url: '/data/sheet-3',
      },
    ],
    comments: [
      {
        id: 'comment-3',
        content: 'Great work on the SEO strategy! These numbers are impressive.',
        author: 'Mike Johnson',
        createdAt: new Date('2025-11-09'),
        mentions: [],
      },
    ],
    folderId: 'folder-3',
    spaceId: 'space-1',
  },
  {
    id: 'insight-4',
    title: 'Email Marketing ROI Opportunity',
    summary: 'Email marketing generated $187,000 (15% of revenue) with relatively low investment. There\'s opportunity to increase frequency and segment targeting to boost this high-ROI channel.',
    status: 'Open',
    priority: 'Medium', // Added: Good opportunity but not critical
    dateCreated: new Date('2025-11-14'),
    createdBy: 'Mike Johnson',
    tags: ['tag-1', 'tag-2'],
    sources: [
      {
        id: 'source-7',
        type: 'datasheet',
        name: 'Email Campaign Results',
        url: '/data/sheet-4',
      },
      {
        id: 'source-8',
        type: 'chat',
        name: 'Email Strategy Discussion',
        url: '/ai-chat',
        chatBubbleId: 'chat-msg-789',
      },
    ],
    comments: [],
    folderId: 'folder-1',
    spaceId: 'space-1',
  },
  {
    id: 'insight-5',
    title: 'Q4 Budget Reallocation Strategy',
    summary: 'Based on channel performance data, recommend shifting 20% of Facebook Ads budget ($9,046) to Google Ads and increasing email marketing investment by $5,000. Projected ROI improvement: +18%.',
    status: 'Open',
    priority: 'High', // Added: Strategic decision requiring action
    dateCreated: new Date('2025-11-15'),
    createdBy: 'Sarah Chen',
    tags: ['tag-2', 'tag-4', 'tag-5'],
    sources: [
      {
        id: 'source-9',
        type: 'chat',
        name: 'Budget Planning Chat',
        url: '/ai-chat',
        chatBubbleId: 'chat-msg-101',
      },
      {
        id: 'source-10',
        type: 'datasheet',
        name: 'Q4 Budget Sheet',
        url: '/data/sheet-5',
      },
      {
        id: 'source-11',
        type: 'datasheet',
        name: 'Channel Performance Comparison',
        url: '/data/sheet-6',
      },
    ],
    comments: [
      {
        id: 'comment-4',
        content: '@Sarah Chen I agree with this strategy. Let\'s schedule a meeting to discuss implementation timeline.',
        author: 'Mike Johnson',
        createdAt: new Date('2025-11-15'),
        mentions: ['Sarah Chen'],
      },
    ],
    folderId: 'folder-2',
    spaceId: 'space-1',
  },
];

// Mock team members for filtering and assignment
export const mockTeamMembers = [
  { id: 'user-1', name: 'Sarah Chen', avatar: 'SC' },
  { id: 'user-2', name: 'Mike Johnson', avatar: 'MJ' },
  { id: 'user-3', name: 'Alex Rivera', avatar: 'AR' },
];