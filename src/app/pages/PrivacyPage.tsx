/**
 * PrivacyPage.tsx — Public Privacy Policy (Black & White Design)
 *
 * Public route: /privacy
 * No auth required — accessible by Stripe reviewers and visitors.
 * PDPA-compliant privacy policy for a Malaysian children's education app.
 */
import React from 'react';
import { Link } from 'react-router';
import { Shield, ArrowLeft } from 'lucide-react';
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

export function PrivacyPage() {
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
            to="/terms"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
          >
            Terms of Service
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
              <Shield className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight">
                Privacy Policy
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
            Project Lumi ("we", "us", "our") operates the Foxy Adventure application (the "Service"),
            accessible at <strong className="text-gray-950">projectlumi.org</strong>.
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information.
            We comply with Malaysia's Personal Data Protection Act 2010 (PDPA).
          </p>

          <Section title="1. Information We Collect">
            <p><strong className="text-gray-950">Parent/Guardian:</strong> Name, email, phone number (optional), and account credentials.</p>
            <p><strong className="text-gray-950">Child:</strong> First name, age, and assessment responses. We do not collect photos, precise location, or government identifiers.</p>
            <p><strong className="text-gray-950">Payment:</strong> Processed by Stripe. We do not store credit card numbers or CVVs.</p>
            <p><strong className="text-gray-950">Usage Data:</strong> Anonymized analytics (pages visited, device type, browser) to improve the Service.</p>
            <p><strong className="text-gray-950">Kindergarten Staff:</strong> Name, email, school name, and contact details for institutional accounts.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Provide, operate, and maintain the Service</li>
              <li>Generate educational assessments and reports</li>
              <li>Process subscription payments via Stripe</li>
              <li>Send transactional communications</li>
              <li>Improve and personalize the experience</li>
              <li>Respond to support inquiries</li>
              <li>Comply with Malaysian law</li>
            </ul>
          </Section>

          <Section title="3. Children's Privacy">
            <p>
              The Service is designed for children aged 4-12 under parental supervision. We take children's privacy seriously:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Child accounts can only be created by a registered parent/guardian</li>
              <li>We collect minimum data necessary (first name, age, answers)</li>
              <li>We do not display advertisements to children</li>
              <li>We do not sell or share children's data for marketing</li>
              <li>Parents may request deletion at any time</li>
            </ul>
          </Section>

          <Section title="4. Data Storage and Security">
            <p>
              Data is stored securely using Supabase with encryption at rest and in transit (TLS 1.2+).
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Encrypted database storage</li>
              <li>Secure authentication with PKCE flow</li>
              <li>Role-based access controls</li>
              <li>Regular security reviews</li>
            </ul>
          </Section>

          <Section title="5. Third-Party Services">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-gray-950">Supabase</strong> — Database, authentication, file storage</li>
              <li><strong className="text-gray-950">Stripe</strong> — Payment processing</li>
              <li><strong className="text-gray-950">Unsplash</strong> — Stock imagery</li>
            </ul>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain data for as long as your account is active. If you delete your account,
              personal data is removed within 30 days, except where retention is required by law.
            </p>
          </Section>

          <Section title="7. Cookies and Local Storage">
            <p>
              We use browser local storage (not tracking cookies) for login sessions, language preferences,
              and assessment progress. No third-party advertising or tracking cookies.
            </p>
          </Section>

          <Section title="8. Your Rights Under PDPA">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-gray-950">Access</strong> — Request a copy of your personal data</li>
              <li><strong className="text-gray-950">Correction</strong> — Request correction of inaccurate data</li>
              <li><strong className="text-gray-950">Withdrawal</strong> — Withdraw consent at any time</li>
              <li><strong className="text-gray-950">Deletion</strong> — Request deletion of your and your child's data</li>
            </ul>
            <p className="mt-2">
              Contact <strong className="text-gray-950">support@projectlumi.org</strong>. We respond within 21 days per PDPA.
            </p>
          </Section>

          <Section title="9. Data Disclosure">
            <p>We do not sell personal data. We may disclose data only:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>To comply with legal obligations</li>
              <li>To protect rights, property, or safety</li>
              <li>To authorized service providers (Supabase, Stripe)</li>
              <li>To a kindergarten, only if the parent has explicitly linked their child's account</li>
            </ul>
          </Section>

          <Section title="10. International Transfers">
            <p>
              Our infrastructure providers may process data outside Malaysia. Appropriate safeguards are in place per PDPA.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this policy. Registered users will be notified via email of material changes.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p>Questions about this Privacy Policy? Contact us:</p>
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
