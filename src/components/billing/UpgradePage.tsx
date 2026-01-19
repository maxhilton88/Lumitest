import React, { useState } from 'react';
import { Check, Zap, X } from 'lucide-react';

interface UpgradePageProps {
  onClose: () => void;
  onSelectPlan: (planId: string) => void;
}

export const UpgradePage: React.FC<UpgradePageProps> = ({ onClose, onSelectPlan }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  const plans = [
    {
      id: 'trial',
      name: 'Free Trial',
      price: { monthly: 0, annual: 0 },
      description: 'Perfect for testing',
      features: [
        'Up to 15 leads',
        '30 days access',
        'Basic analytics',
        'Email support'
      ],
      limitations: [
        'No custom branding',
        'Limited questions',
        'No API access',
        '16th lead onwards will be blurred'
      ],
      current: true,
      cta: 'Current Plan',
      popular: false
    },
    {
      id: 'pro',
      name: 'Professional',
      price: { monthly: 49, annual: 356 },
      description: 'For growing kindergartens',
      features: [
        'Unlimited leads',
        'Full analytics dashboard',
        'Custom school branding',
        'All question modules',
        'Priority email support',
        'Export to CSV',
        'WhatsApp integration',
        'Multi-language support',
        'No limitations'
      ],
      limitations: [],
      current: false,
      cta: 'Upgrade Now',
      popular: true,
      savings: billingCycle === 'annual' ? 'Save RM232/year' : null
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Upgrade Your Plan</h1>
              <p className="text-sm text-gray-500 mt-1">Choose the perfect plan for your kindergarten</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
            className={`
              relative w-14 h-8 rounded-full transition-all duration-300
              ${billingCycle === 'annual' ? 'bg-black' : 'bg-gray-200'}
            `}
          >
            <div
              className={`
                absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300
                ${billingCycle === 'annual' ? 'left-7' : 'left-1'}
              `}
            />
          </button>
          <span className={`text-sm font-medium ${billingCycle === 'annual' ? 'text-gray-900' : 'text-gray-500'}`}>
            Annual
          </span>
          {billingCycle === 'annual' && (
            <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              Save up to 40%
            </span>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`
                relative border rounded-lg p-8 transition-all
                ${plan.popular 
                  ? 'border-black ring-2 ring-black' 
                  : 'border-gray-100 hover:border-gray-200'}
              `}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="px-3 py-1 bg-black text-white text-xs font-medium rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Most Popular
                  </div>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                
                <div className="flex items-end justify-center gap-2">
                  <span className="text-sm text-gray-500">RM</span>
                  <span className="text-4xl font-semibold text-gray-900">
                    {plan.price[billingCycle]}
                  </span>
                  <span className="text-sm text-gray-500 mb-2">
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                
                {plan.savings && (
                  <p className="text-xs text-green-600 font-medium mt-2">{plan.savings}</p>
                )}
              </div>

              {/* CTA Button */}
              <button
                onClick={() => !plan.current && onSelectPlan(plan.id)}
                disabled={plan.current}
                className={`
                  w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors mb-6
                  ${plan.current
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : plan.popular
                    ? 'bg-black text-white hover:bg-gray-800'
                    : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'}
                `}
              >
                {plan.cta}
              </button>

              {/* Features */}
              <div className="space-y-3">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-gray-900 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">{feature}</span>
                  </div>
                ))}
                {plan.limitations.map((limitation, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <X className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-400">{limitation}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500 mb-4">Trusted by kindergartens across Malaysia</p>
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-600">Secure Payment</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-600">Cancel Anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-600">14-Day Money Back</span>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-base font-semibold text-gray-900 mb-6 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'Can I change plans later?',
                a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.'
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, debit cards, and online banking through Stripe.'
              },
              {
                q: 'Is there a setup fee?',
                a: 'No, there are no setup fees or hidden charges. You only pay the subscription price.'
              },
              {
                q: 'What happens after my trial ends?',
                a: 'Your account will be limited to read-only access. Upgrade anytime to continue collecting leads.'
              }
            ].map((faq, index) => (
              <div key={index} className="border border-gray-100 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};