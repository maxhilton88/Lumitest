/**
 * TermsPage.tsx — Public Terms of Service (Black & White Design)
 *
 * Public route: /terms
 * No auth required — accessible by Stripe reviewers and visitors.
 * Malaysian-law-governed terms for a children's education SaaS.
 */
import React from 'react';
import { Link } from 'react-router';
import { ScrollText, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-bold text-gray-950 mb-3">{title}</h2>
      <div className="text-xs sm:text-sm leading-relaxed space-y-2 text-gray-500">
        {children}
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Back + nav */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 bg-gray-50 border border-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
          <Link
            to="/privacy"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
          >
            Privacy Policy
          </Link>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <ScrollText className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight">
                Terms of Service
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Effective: February 1, 2026 &middot; Updated: February 18, 2026
              </p>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8"
        >
          <p className="text-xs sm:text-sm leading-relaxed mb-8 text-gray-500">
            Welcome to Foxy Adventure. These Terms of Service ("Terms") govern your access to and use of
            the Foxy Adventure application (the "Service") operated by Project Lumi ("we", "us", "our"),
            accessible at <strong className="text-gray-950">projectlumi.org</strong>.
            By accessing or using the Service, you agree to be bound by these Terms. If you do not agree,
            please do not use the Service.
          </p>

          <Section title="1. Service Description">
            <p>
              Foxy Adventure is a gamified educational assessment platform for children aged 4-12 years,
              designed to evaluate school readiness in alignment with Malaysia's KSSR curriculum. The Service includes:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Interactive assessment quests across multiple subjects (English, BM, Mathematics, Mandarin)</li>
              <li>Educational video library</li>
              <li>Detailed readiness reports and mastery dashboards</li>
              <li>Optional premium features via paid subscription plans</li>
              <li>Optional physical AI companion toy (FOXY-o1) bundled with Plan B</li>
            </ul>
          </Section>

          <Section title="2. Eligibility and Account Registration">
            <p>
              You must be at least 18 years of age to create an account. By registering, you represent that you are
              the parent or legal guardian of any child using the Service under your account.
            </p>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities
              that occur under your account.
            </p>
          </Section>

          <Section title="3. Free and Paid Plans">
            <p><strong className="text-gray-950">Free Tier:</strong> Includes one assessment per child, basic reports, free video content, and a shareable report link.</p>
            <p><strong className="text-gray-950">Plan A (Digital):</strong> RM 365/year. Unlimited assessments, full video library, practice mode, progress tracking, and priority support.</p>
            <p><strong className="text-gray-950">Plan B (Digital + Toy):</strong> RM 365 first year (50% intro discount). Everything in Plan A plus the FOXY-o1 AI companion toy with free shipping. Renewal: RM 365/year digital only.</p>
            <p>
              All prices are in MYR and are inclusive of applicable taxes unless stated otherwise.
              We may modify pricing with 30 days' advance notice.
            </p>
          </Section>

          <Section title="4. Payment and Billing">
            <p>
              Payments are processed by <strong className="text-gray-950">Stripe</strong>.
              Subscriptions renew automatically unless cancelled. You may cancel anytime via the Stripe customer portal.
              Upon cancellation, you retain access until the end of your billing period. No partial refunds.
            </p>
          </Section>

          <Section title="5. Refund Policy">
            <p>
              <strong className="text-gray-950">14-day refund window</strong> from initial subscription purchase.
              For Plan B: the toy must be returned in unused condition within 14 days. Return shipping is the customer's responsibility.
            </p>
          </Section>

          <Section title="6. Physical Product (FOXY-o1 Toy)">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Free shipping within Peninsular and East Malaysia</li>
              <li>Estimated delivery: 7-14 business days</li>
              <li>International shipping available at additional cost</li>
              <li>The toy is yours to keep even if you cancel the digital subscription</li>
              <li>Warranty: 6 months for manufacturing defects</li>
            </ul>
          </Section>

          <Section title="7. Acceptable Use">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt unauthorized access to any part of the Service</li>
              <li>Reverse engineer or decompile any part of the Service</li>
              <li>Use bots or scrapers without written permission</li>
              <li>Share account credentials with third parties</li>
              <li>Upload harmful content including malware or offensive material</li>
            </ul>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              All content, features, and functionality — including characters, video content, assessment questions,
              software code, and the FOXY-o1 design — are the exclusive property of Project Lumi,
              protected by Malaysian and international intellectual property laws.
            </p>
          </Section>

          <Section title="9. User-Generated Content">
            <p>
              Assessment responses and child data remain the property of the parent/guardian.
              You grant us a limited license to process this data solely for generating educational reports.
            </p>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <p>
              The Service is provided "as is" without warranties of any kind. Assessment results are supplementary
              and should not replace professional educational evaluations.
            </p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>
              Project Lumi shall not be liable for indirect, incidental, or consequential damages.
              Our total liability shall not exceed the amount paid in the preceding 12 months.
            </p>
          </Section>

          <Section title="12. Termination">
            <p>
              We may suspend or terminate access for violation of these Terms.
              You may terminate your account by contacting support@projectlumi.org.
            </p>
          </Section>

          <Section title="13. Governing Law">
            <p>
              These Terms are governed by Malaysian law. Disputes are subject to the exclusive
              jurisdiction of the courts of Malaysia. Both parties agree to attempt good-faith negotiation for 30 days.
            </p>
          </Section>

          <Section title="14. Contact Us">
            <p>Questions about these Terms? Contact us:</p>
            <div className="mt-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <p className="font-semibold text-gray-950">Project Lumi</p>
              <p>Email: support@projectlumi.org</p>
              <p>Website: projectlumi.org</p>
              <p>Country: Malaysia</p>
            </div>
          </Section>
        </motion.div>
      </div>
    </div>
  );
}
