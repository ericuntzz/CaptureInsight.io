// Mock marketing performance data for CaptureInsight demo
export interface MarketingData {
  account_id: number;
  account_name: string;
  pricing_type: string;
  usage_frequency: string;
  product_revenue: string;
  processing_revenue: string;
  first_transaction_date: string;
  registrant_count: number;
  attribution: string;
}

export const marketingData: MarketingData[] = [
  {
    account_id: 185200,
    account_name: "Wellness Works Management Partners",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$6,229.68",
    processing_revenue: "$1,261.69",
    first_transaction_date: "2025-07-29",
    registrant_count: 92,
    attribution: "inbound marketing"
  },
  {
    account_id: 184341,
    account_name: "Tiburon Peninsula Club",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$2,391.66",
    processing_revenue: "$703.62",
    first_transaction_date: "2025-08-01",
    registrant_count: 1136,
    attribution: "inbound marketing"
  },
  {
    account_id: 181603,
    account_name: "Events - Fight, Laugh & Feast",
    pricing_type: "both",
    usage_frequency: "multiple",
    product_revenue: "$1,743.68",
    processing_revenue: "$39.26",
    first_transaction_date: "2025-05-16",
    registrant_count: 249,
    attribution: "inbound marketing"
  },
  {
    account_id: 184003,
    account_name: "Tito's Handmade Vodka",
    pricing_type: "free",
    usage_frequency: "annually",
    product_revenue: "$1,638.45",
    processing_revenue: "$0",
    first_transaction_date: "2025-06-10",
    registrant_count: 1,
    attribution: "search"
  },
  {
    account_id: 179737,
    account_name: "Environmental Federation of Oklahoma",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$1,637.18",
    processing_revenue: "$1,028.55",
    first_transaction_date: "2025-04-15",
    registrant_count: 352,
    attribution: "search"
  },
  {
    account_id: 183456,
    account_name: "Mountain View Athletic Association",
    pricing_type: "paid",
    usage_frequency: "monthly",
    product_revenue: "$3,456.78",
    processing_revenue: "$892.34",
    first_transaction_date: "2025-06-22",
    registrant_count: 567,
    attribution: "referral"
  },
  {
    account_id: 182901,
    account_name: "Coastal Community Foundation",
    pricing_type: "paid",
    usage_frequency: "quarterly",
    product_revenue: "$2,890.45",
    processing_revenue: "$645.23",
    first_transaction_date: "2025-05-30",
    registrant_count: 423,
    attribution: "inbound marketing"
  },
  {
    account_id: 180234,
    account_name: "Tech Innovators Summit",
    pricing_type: "both",
    usage_frequency: "annually",
    product_revenue: "$4,123.90",
    processing_revenue: "$1,089.67",
    first_transaction_date: "2025-04-18",
    registrant_count: 789,
    attribution: "search"
  },
  {
    account_id: 186789,
    account_name: "Green Earth Initiative",
    pricing_type: "free",
    usage_frequency: "monthly",
    product_revenue: "$987.23",
    processing_revenue: "$0",
    first_transaction_date: "2025-08-15",
    registrant_count: 234,
    attribution: "social media"
  },
  {
    account_id: 181567,
    account_name: "Downtown Business Alliance",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$5,678.90",
    processing_revenue: "$1,456.78",
    first_transaction_date: "2025-05-10",
    registrant_count: 892,
    attribution: "inbound marketing"
  },
  {
    account_id: 185432,
    account_name: "Creative Arts Collective",
    pricing_type: "paid",
    usage_frequency: "monthly",
    product_revenue: "$2,345.67",
    processing_revenue: "$567.89",
    first_transaction_date: "2025-07-05",
    registrant_count: 345,
    attribution: "referral"
  },
  {
    account_id: 183678,
    account_name: "Regional Healthcare Network",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$7,890.12",
    processing_revenue: "$1,890.45",
    first_transaction_date: "2025-06-14",
    registrant_count: 1245,
    attribution: "search"
  },
  {
    account_id: 180987,
    account_name: "Youth Development Program",
    pricing_type: "both",
    usage_frequency: "quarterly",
    product_revenue: "$1,567.89",
    processing_revenue: "$234.56",
    first_transaction_date: "2025-04-28",
    registrant_count: 456,
    attribution: "inbound marketing"
  },
  {
    account_id: 184789,
    account_name: "Heritage Museum Association",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$3,234.56",
    processing_revenue: "$789.23",
    first_transaction_date: "2025-07-12",
    registrant_count: 678,
    attribution: "social media"
  },
  {
    account_id: 182345,
    account_name: "Urban Farming Co-op",
    pricing_type: "free",
    usage_frequency: "monthly",
    product_revenue: "$890.45",
    processing_revenue: "$0",
    first_transaction_date: "2025-05-25",
    registrant_count: 123,
    attribution: "referral"
  },
  {
    account_id: 186234,
    account_name: "Professional Women's Network",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$4,567.89",
    processing_revenue: "$1,123.45",
    first_transaction_date: "2025-08-03",
    registrant_count: 891,
    attribution: "inbound marketing"
  },
  {
    account_id: 181890,
    account_name: "Sustainable Energy Alliance",
    pricing_type: "paid",
    usage_frequency: "quarterly",
    product_revenue: "$3,678.90",
    processing_revenue: "$892.34",
    first_transaction_date: "2025-05-08",
    registrant_count: 567,
    attribution: "search"
  },
  {
    account_id: 183901,
    account_name: "Community Theater Guild",
    pricing_type: "both",
    usage_frequency: "monthly",
    product_revenue: "$2,123.45",
    processing_revenue: "$456.78",
    first_transaction_date: "2025-06-19",
    registrant_count: 345,
    attribution: "social media"
  },
  {
    account_id: 185678,
    account_name: "Regional Food Bank",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$6,789.23",
    processing_revenue: "$1,567.89",
    first_transaction_date: "2025-07-28",
    registrant_count: 1023,
    attribution: "inbound marketing"
  },
  {
    account_id: 180456,
    account_name: "Innovation Hub Workspace",
    pricing_type: "paid",
    usage_frequency: "monthly",
    product_revenue: "$3,890.45",
    processing_revenue: "$945.67",
    first_transaction_date: "2025-04-22",
    registrant_count: 678,
    attribution: "referral"
  },
  {
    account_id: 184567,
    account_name: "Maritime Heritage Society",
    pricing_type: "free",
    usage_frequency: "annually",
    product_revenue: "$1,234.56",
    processing_revenue: "$0",
    first_transaction_date: "2025-07-06",
    registrant_count: 234,
    attribution: "search"
  },
  {
    account_id: 182678,
    account_name: "Educational Excellence Foundation",
    pricing_type: "paid",
    usage_frequency: "quarterly",
    product_revenue: "$4,345.67",
    processing_revenue: "$1,089.23",
    first_transaction_date: "2025-05-31",
    registrant_count: 789,
    attribution: "inbound marketing"
  },
  {
    account_id: 186123,
    account_name: "Animal Rescue League",
    pricing_type: "paid",
    usage_frequency: "monthly",
    product_revenue: "$2,567.89",
    processing_revenue: "$623.45",
    first_transaction_date: "2025-08-09",
    registrant_count: 456,
    attribution: "social media"
  },
  {
    account_id: 181234,
    account_name: "Jazz & Blues Festival",
    pricing_type: "both",
    usage_frequency: "annually",
    product_revenue: "$5,234.78",
    processing_revenue: "$1,289.56",
    first_transaction_date: "2025-05-03",
    registrant_count: 934,
    attribution: "search"
  },
  {
    account_id: 183234,
    account_name: "Neighborhood Watch Coalition",
    pricing_type: "free",
    usage_frequency: "monthly",
    product_revenue: "$678.90",
    processing_revenue: "$0",
    first_transaction_date: "2025-06-11",
    registrant_count: 145,
    attribution: "referral"
  },
  {
    account_id: 185901,
    account_name: "Artisan Makers Marketplace",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$3,567.89",
    processing_revenue: "$867.34",
    first_transaction_date: "2025-07-21",
    registrant_count: 623,
    attribution: "inbound marketing"
  },
  {
    account_id: 180678,
    account_name: "Climate Action Network",
    pricing_type: "paid",
    usage_frequency: "quarterly",
    product_revenue: "$4,678.90",
    processing_revenue: "$1,145.67",
    first_transaction_date: "2025-04-26",
    registrant_count: 812,
    attribution: "search"
  },
  {
    account_id: 184234,
    account_name: "Local Writers Workshop",
    pricing_type: "both",
    usage_frequency: "monthly",
    product_revenue: "$1,890.45",
    processing_revenue: "$378.23",
    first_transaction_date: "2025-06-28",
    registrant_count: 289,
    attribution: "social media"
  },
  {
    account_id: 182456,
    account_name: "Fitness & Wellness Center",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$5,890.23",
    processing_revenue: "$1,423.56",
    first_transaction_date: "2025-05-17",
    registrant_count: 967,
    attribution: "inbound marketing"
  },
  {
    account_id: 186456,
    account_name: "Historical Preservation Society",
    pricing_type: "paid",
    usage_frequency: "monthly",
    product_revenue: "$2,789.34",
    processing_revenue: "$678.90",
    first_transaction_date: "2025-08-12",
    registrant_count: 534,
    attribution: "referral"
  },
  {
    account_id: 181456,
    account_name: "Science Education Initiative",
    pricing_type: "free",
    usage_frequency: "quarterly",
    product_revenue: "$1,123.45",
    processing_revenue: "$0",
    first_transaction_date: "2025-05-05",
    registrant_count: 267,
    attribution: "search"
  },
  {
    account_id: 183567,
    account_name: "Community Garden Alliance",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$2,456.78",
    processing_revenue: "$589.23",
    first_transaction_date: "2025-06-16",
    registrant_count: 445,
    attribution: "inbound marketing"
  },
  {
    account_id: 185234,
    account_name: "Youth Sports League",
    pricing_type: "paid",
    usage_frequency: "quarterly",
    product_revenue: "$3,234.56",
    processing_revenue: "$789.45",
    first_transaction_date: "2025-07-09",
    registrant_count: 678,
    attribution: "social media"
  },
  {
    account_id: 180890,
    account_name: "Cultural Exchange Program",
    pricing_type: "both",
    usage_frequency: "monthly",
    product_revenue: "$1,678.90",
    processing_revenue: "$334.56",
    first_transaction_date: "2025-04-30",
    registrant_count: 312,
    attribution: "referral"
  },
  {
    account_id: 184890,
    account_name: "Tech Literacy Foundation",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$4,890.45",
    processing_revenue: "$1,189.67",
    first_transaction_date: "2025-07-18",
    registrant_count: 834,
    attribution: "search"
  },
  {
    account_id: 182123,
    account_name: "Makers & Creators Hub",
    pricing_type: "free",
    usage_frequency: "monthly",
    product_revenue: "$789.23",
    processing_revenue: "$0",
    first_transaction_date: "2025-05-23",
    registrant_count: 178,
    attribution: "inbound marketing"
  },
  {
    account_id: 186567,
    account_name: "Environmental Justice Coalition",
    pricing_type: "paid",
    usage_frequency: "quarterly",
    product_revenue: "$3,678.45",
    processing_revenue: "$892.34",
    first_transaction_date: "2025-08-06",
    registrant_count: 623,
    attribution: "social media"
  },
  {
    account_id: 181678,
    account_name: "Film Society & Cinema Club",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$2,678.90",
    processing_revenue: "$645.23",
    first_transaction_date: "2025-05-12",
    registrant_count: 489,
    attribution: "referral"
  },
  {
    account_id: 183789,
    account_name: "Renewable Energy Co-op",
    pricing_type: "both",
    usage_frequency: "monthly",
    product_revenue: "$4,123.56",
    processing_revenue: "$1,012.89",
    first_transaction_date: "2025-06-24",
    registrant_count: 756,
    attribution: "search"
  },
  {
    account_id: 185567,
    account_name: "Arts Education Alliance",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$5,234.67",
    processing_revenue: "$1,278.90",
    first_transaction_date: "2025-07-15",
    registrant_count: 901,
    attribution: "inbound marketing"
  },
  {
    account_id: 180234,
    account_name: "Community Health Initiative",
    pricing_type: "paid",
    usage_frequency: "quarterly",
    product_revenue: "$3,456.78",
    processing_revenue: "$845.67",
    first_transaction_date: "2025-04-19",
    registrant_count: 634,
    attribution: "social media"
  },
  {
    account_id: 184123,
    account_name: "Veterans Support Network",
    pricing_type: "free",
    usage_frequency: "monthly",
    product_revenue: "$1,012.34",
    processing_revenue: "$0",
    first_transaction_date: "2025-06-30",
    registrant_count: 223,
    attribution: "referral"
  },
  {
    account_id: 182789,
    account_name: "Sustainable Living Workshop",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$2,890.45",
    processing_revenue: "$689.23",
    first_transaction_date: "2025-06-02",
    registrant_count: 512,
    attribution: "search"
  },
  {
    account_id: 186890,
    account_name: "Dance & Movement Studio",
    pricing_type: "paid",
    usage_frequency: "monthly",
    product_revenue: "$2,234.56",
    processing_revenue: "$545.67",
    first_transaction_date: "2025-08-17",
    registrant_count: 423,
    attribution: "inbound marketing"
  },
  {
    account_id: 181901,
    account_name: "Literacy & Learning Center",
    pricing_type: "both",
    usage_frequency: "quarterly",
    product_revenue: "$1,567.89",
    processing_revenue: "$312.45",
    first_transaction_date: "2025-05-14",
    registrant_count: 345,
    attribution: "social media"
  },
  {
    account_id: 183456,
    account_name: "Outdoor Adventure Club",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$4,567.90",
    processing_revenue: "$1,112.34",
    first_transaction_date: "2025-06-21",
    registrant_count: 789,
    attribution: "referral"
  },
  {
    account_id: 185789,
    account_name: "Mental Health Advocacy",
    pricing_type: "free",
    usage_frequency: "monthly",
    product_revenue: "$890.23",
    processing_revenue: "$0",
    first_transaction_date: "2025-07-24",
    registrant_count: 198,
    attribution: "search"
  },
  {
    account_id: 180567,
    account_name: "Regional Arts Council",
    pricing_type: "paid",
    usage_frequency: "quarterly",
    product_revenue: "$3,789.45",
    processing_revenue: "$923.56",
    first_transaction_date: "2025-04-27",
    registrant_count: 667,
    attribution: "inbound marketing"
  },
  {
    account_id: 184456,
    account_name: "Innovation & Technology Summit",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$6,123.78",
    processing_revenue: "$1,489.23",
    first_transaction_date: "2025-07-03",
    registrant_count: 1089,
    attribution: "social media"
  },
  {
    account_id: 182901,
    account_name: "Heritage Crafts Guild",
    pricing_type: "both",
    usage_frequency: "monthly",
    product_revenue: "$1,456.78",
    processing_revenue: "$289.34",
    first_transaction_date: "2025-06-07",
    registrant_count: 278,
    attribution: "referral"
  },
  {
    account_id: 186234,
    account_name: "Community Development Corp",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$5,678.45",
    processing_revenue: "$1,389.67",
    first_transaction_date: "2025-08-10",
    registrant_count: 945,
    attribution: "search"
  },
  {
    account_id: 181234,
    account_name: "Youth Mentorship Program",
    pricing_type: "paid",
    usage_frequency: "quarterly",
    product_revenue: "$2,345.67",
    processing_revenue: "$567.89",
    first_transaction_date: "2025-05-06",
    registrant_count: 434,
    attribution: "inbound marketing"
  },
  {
    account_id: 183123,
    account_name: "Local Food Network",
    pricing_type: "free",
    usage_frequency: "monthly",
    product_revenue: "$723.45",
    processing_revenue: "$0",
    first_transaction_date: "2025-06-13",
    registrant_count: 156,
    attribution: "social media"
  },
  {
    account_id: 185345,
    account_name: "Professional Development Institute",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$4,234.89",
    processing_revenue: "$1,034.56",
    first_transaction_date: "2025-07-11",
    registrant_count: 723,
    attribution: "referral"
  },
  {
    account_id: 180789,
    account_name: "Creative Writing Workshop",
    pricing_type: "paid",
    usage_frequency: "monthly",
    product_revenue: "$1,678.23",
    processing_revenue: "$412.34",
    first_transaction_date: "2025-04-24",
    registrant_count: 312,
    attribution: "search"
  },
  {
    account_id: 184678,
    account_name: "Music Education Foundation",
    pricing_type: "both",
    usage_frequency: "quarterly",
    product_revenue: "$3,123.45",
    processing_revenue: "$756.78",
    first_transaction_date: "2025-07-07",
    registrant_count: 589,
    attribution: "inbound marketing"
  },
  {
    account_id: 182234,
    account_name: "Senior Citizens Association",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$2,567.90",
    processing_revenue: "$623.45",
    first_transaction_date: "2025-05-28",
    registrant_count: 478,
    attribution: "social media"
  },
  {
    account_id: 186678,
    account_name: "Eco-Tourism Cooperative",
    pricing_type: "free",
    usage_frequency: "quarterly",
    product_revenue: "$1,234.67",
    processing_revenue: "$0",
    first_transaction_date: "2025-08-14",
    registrant_count: 245,
    attribution: "referral"
  },
  {
    account_id: 181567,
    account_name: "Photography Arts Center",
    pricing_type: "paid",
    usage_frequency: "monthly",
    product_revenue: "$2,123.78",
    processing_revenue: "$512.90",
    first_transaction_date: "2025-05-11",
    registrant_count: 389,
    attribution: "search"
  },
  {
    account_id: 183890,
    account_name: "Wellness & Mindfulness Studio",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$3,890.56",
    processing_revenue: "$945.23",
    first_transaction_date: "2025-06-25",
    registrant_count: 678,
    attribution: "inbound marketing"
  },
  {
    account_id: 185123,
    account_name: "Community Theatre Productions",
    pricing_type: "both",
    usage_frequency: "quarterly",
    product_revenue: "$2,678.34",
    processing_revenue: "$645.67",
    first_transaction_date: "2025-07-13",
    registrant_count: 512,
    attribution: "social media"
  },
  {
    account_id: 180345,
    account_name: "Urban Planning Coalition",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$4,789.23",
    processing_revenue: "$1,167.89",
    first_transaction_date: "2025-04-21",
    registrant_count: 823,
    attribution: "referral"
  },
  {
    account_id: 184234,
    account_name: "Language & Culture Exchange",
    pricing_type: "free",
    usage_frequency: "monthly",
    product_revenue: "$845.67",
    processing_revenue: "$0",
    first_transaction_date: "2025-07-01",
    registrant_count: 189,
    attribution: "search"
  },
  {
    account_id: 182567,
    account_name: "Small Business Alliance",
    pricing_type: "paid",
    usage_frequency: "quarterly",
    product_revenue: "$3,345.89",
    processing_revenue: "$812.34",
    first_transaction_date: "2025-06-04",
    registrant_count: 601,
    attribution: "inbound marketing"
  },
  {
    account_id: 186345,
    account_name: "Nutrition & Cooking School",
    pricing_type: "paid",
    usage_frequency: "monthly",
    product_revenue: "$1,989.45",
    processing_revenue: "$478.23",
    first_transaction_date: "2025-08-08",
    registrant_count: 367,
    attribution: "social media"
  },
  {
    account_id: 181789,
    account_name: "Public Art Initiative",
    pricing_type: "both",
    usage_frequency: "annually",
    product_revenue: "$4,456.78",
    processing_revenue: "$1,089.56",
    first_transaction_date: "2025-05-19",
    registrant_count: 756,
    attribution: "referral"
  },
  {
    account_id: 183234,
    account_name: "Women in Tech Network",
    pricing_type: "paid",
    usage_frequency: "quarterly",
    product_revenue: "$2,890.67",
    processing_revenue: "$701.23",
    first_transaction_date: "2025-06-17",
    registrant_count: 534,
    attribution: "search"
  },
  {
    account_id: 185456,
    account_name: "Historic District Association",
    pricing_type: "paid",
    usage_frequency: "annually",
    product_revenue: "$3,567.45",
    processing_revenue: "$867.89",
    first_transaction_date: "2025-07-20",
    registrant_count: 645,
    attribution: "inbound marketing"
  }
];
