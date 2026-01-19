import React, { useState } from 'react';
import { ArrowLeft, Lock, CreditCard } from 'lucide-react';

interface StripeCheckoutProps {
  planId: string;
  planName: string;
  amount: number;
  billingCycle: 'monthly' | 'annual';
  onBack: () => void;
  onSuccess: () => void;
}

export const StripeCheckout: React.FC<StripeCheckoutProps> = ({
  planId,
  planName,
  amount,
  billingCycle,
  onBack,
  onSuccess
}) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\s/g, '');
    value = value.replace(/(\d{4})/g, '$1 ').trim();
    setCardNumber(value.slice(0, 19));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    setExpiry(value.slice(0, 5));
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCvc(e.target.value.replace(/\D/g, '').slice(0, 3));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      onSuccess();
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to plans
          </button>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-green-600" />
            <h1 className="text-lg font-semibold text-gray-900">Secure Checkout</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">Your payment information is encrypted and secure</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Payment Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900 transition-colors"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Receipt will be sent to this email</p>
              </div>

              {/* Card Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Information
                </label>
                <div className="space-y-3">
                  {/* Card Number */}
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="1234 1234 1234 1234"
                      className="w-full pl-11 pr-3 py-3 border border-gray-200 rounded-t-lg text-sm focus:outline-none focus:border-gray-900 transition-colors"
                      required
                    />
                  </div>
                  
                  {/* Expiry & CVC */}
                  <div className="grid grid-cols-2 gap-0">
                    <input
                      type="text"
                      value={expiry}
                      onChange={handleExpiryChange}
                      placeholder="MM/YY"
                      className="px-3 py-3 border border-gray-200 border-t-0 rounded-bl-lg text-sm focus:outline-none focus:border-gray-900 transition-colors"
                      required
                    />
                    <input
                      type="text"
                      value={cvc}
                      onChange={handleCvcChange}
                      placeholder="CVC"
                      className="px-3 py-3 border border-gray-200 border-t-0 border-l-0 rounded-br-lg text-sm focus:outline-none focus:border-gray-900 transition-colors"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Cardholder Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900 transition-colors"
                  required
                />
              </div>

              {/* Country/Region */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country/Region
                </label>
                <select
                  className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900 transition-colors"
                  required
                >
                  <option value="MY">Malaysia</option>
                  <option value="SG">Singapore</option>
                  <option value="ID">Indonesia</option>
                  <option value="TH">Thailand</option>
                </select>
              </div>

              {/* Terms */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="terms"
                  className="mt-1"
                  required
                />
                <label htmlFor="terms" className="text-sm text-gray-600">
                  I agree to the{' '}
                  <a href="#" className="text-gray-900 underline">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="text-gray-900 underline">Privacy Policy</a>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isProcessing}
                className={`
                  w-full px-6 py-4 rounded-lg text-sm font-medium transition-all
                  ${isProcessing
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-black text-white hover:bg-gray-800'}
                `}
              >
                {isProcessing ? 'Processing...' : `Pay RM${amount}`}
              </button>

              {/* Security Notice */}
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <Lock className="w-3 h-3" />
                <span>Secured by Stripe · SSL Encrypted</span>
              </div>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="border border-gray-100 rounded-lg p-6 sticky top-8">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Order Summary</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{planName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {billingCycle === 'monthly' ? 'Billed monthly' : 'Billed annually'}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-gray-900">RM{amount}</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">Subtotal</p>
                  <p className="text-sm text-gray-900">RM{amount}</p>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-600">Tax</p>
                  <p className="text-sm text-gray-900">RM0</p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <p className="text-base font-semibold text-gray-900">Total due</p>
                  <p className="text-base font-semibold text-gray-900">RM{amount}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-900">Secure Payment</p>
                    <p className="text-xs text-gray-500">Your payment info is encrypted</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CreditCard className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-900">Money-Back Guarantee</p>
                    <p className="text-xs text-gray-500">14-day refund policy</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Powered by Stripe */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400">
            Powered by <span className="font-semibold">Stripe</span> · PCI DSS Compliant
          </p>
        </div>
      </div>
    </div>
  );
};
