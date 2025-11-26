import { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, Check, Loader2, Sparkles, Zap, Crown } from 'lucide-react';
import { motion } from 'motion/react';

interface BillingPageProps {
  onBack: () => void;
}

interface BillingInfo {
  plan: string;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string;
  features: {
    maxSpaces: number;
    maxCaptures: number;
    aiAnalysis: boolean;
    teamMembers: number;
  };
  invoices: any[];
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    icon: Sparkles,
    features: [
      '3 Spaces',
      '100 Captures per month',
      'AI Analysis',
      '1 Team member',
      'Community support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    period: 'per month',
    icon: Zap,
    popular: true,
    features: [
      'Unlimited Spaces',
      '1,000 Captures per month',
      'Advanced AI Analysis',
      '5 Team members',
      'Priority support',
      'Custom integrations',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    icon: Crown,
    features: [
      'Unlimited everything',
      'Dedicated support',
      'Custom AI models',
      'SSO & SAML',
      'Audit logs',
      'SLA guarantee',
    ],
  },
];

export function BillingPage({ onBack }: BillingPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [billing, setBilling] = useState<BillingInfo | null>(null);

  useEffect(() => {
    fetchBilling();
  }, []);

  const fetchBilling = async () => {
    try {
      const response = await fetch('/api/billing', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setBilling(data);
      }
    } catch (error) {
      console.error('Failed to fetch billing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0F1219]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 bg-[#0F1219] overflow-auto"
    >
      <div className="max-w-4xl mx-auto p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FFA07A] flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Billing</h1>
            <p className="text-gray-400">Manage your subscription and payment methods</p>
          </div>
        </div>

        {billing && (
          <div className="bg-[#1A1F2E] rounded-xl border border-[rgba(255,107,53,0.2)] p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400">Current Plan</div>
                <div className="text-xl font-semibold text-white capitalize">{billing.plan}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm ${
                  billing.status === 'active' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {billing.status}
                </span>
              </div>
            </div>
            {billing.plan !== 'free' && (
              <div className="mt-4 pt-4 border-t border-[rgba(255,107,53,0.1)]">
                <div className="text-sm text-gray-400">
                  Next billing date: {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        )}

        <h2 className="text-lg font-semibold text-white mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`bg-[#1A1F2E] rounded-xl border p-6 relative ${
                plan.popular 
                  ? 'border-[#FF6B35]' 
                  : 'border-[rgba(255,107,53,0.2)]'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#FF6B35] text-white text-xs font-medium rounded-full">
                  Most Popular
                </div>
              )}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[rgba(255,107,53,0.15)] flex items-center justify-center">
                  <plan.icon className="w-5 h-5 text-[#FF6B35]" />
                </div>
                <div>
                  <div className="text-white font-medium">{plan.name}</div>
                  <div className="text-[#FF6B35] font-semibold">
                    {plan.price} <span className="text-gray-400 text-sm font-normal">{plan.period}</span>
                  </div>
                </div>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-[#FF6B35]" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-2 rounded-lg font-medium transition-colors ${
                  billing?.plan === plan.id
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : plan.popular
                    ? 'bg-[#FF6B35] text-white hover:bg-[#E55A2B]'
                    : 'bg-[rgba(255,107,53,0.15)] text-[#FF6B35] hover:bg-[rgba(255,107,53,0.25)]'
                }`}
                disabled={billing?.plan === plan.id}
              >
                {billing?.plan === plan.id ? 'Current Plan' : plan.id === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
              </button>
            </div>
          ))}
        </div>

        <div className="bg-[#1A1F2E] rounded-xl border border-[rgba(255,107,53,0.2)] p-6">
          <h3 className="text-white font-medium mb-4">Payment History</h3>
          {billing?.invoices && billing.invoices.length > 0 ? (
            <div className="space-y-2">
              {billing.invoices.map((invoice: any, index: number) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-[rgba(255,107,53,0.1)] last:border-0">
                  <span className="text-gray-300">{invoice.date}</span>
                  <span className="text-white">${invoice.amount}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">No invoices yet</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
