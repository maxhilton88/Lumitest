/**
 * PrivacyPage.tsx — Public Privacy Policy
 *
 * Public route: /privacy
 * No auth required — accessible by Stripe reviewers and visitors.
 * PDPA-compliant privacy policy for a Malaysian children's education app.
 */
import React from 'react';
import { Link } from 'react-router';
import { Shield, ArrowLeft } from 'lucide-react';
import { FantasyBackground, FantasyPanel, FantasyTitle, GoldOrnament, FantasyFooter } from '../components/FantasyBackground';
import questMapBg from 'figma:asset/9cb2ea9cdf18b02a3a8d26e99ab2e65f990879b0.png';

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const CINZEL = "'Cinzel Decorative', serif";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm md:text-base font-bold mb-2" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
        {title}
      </h2>
      <div className="text-xs md:text-sm leading-relaxed space-y-2" style={{ color: `${PARCHMENT}85` }}>
        {children}
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="min-h-screen relative">
      <FantasyBackground bgImage={questMapBg} overlayOpacity={0.85} />

      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&display=swap"
        rel="stylesheet"
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-16">

        {/* Back + nav */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
            style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}25`, color: GOLD }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
          <Link
            to="/terms"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
            style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}15`, color: `${PARCHMENT}80` }}
          >
            Terms of Service
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <Shield className="w-8 h-8 mx-auto mb-3" style={{ color: GOLD }} />
          <FantasyTitle size="md">Privacy Policy</FantasyTitle>
          <p className="mt-3 text-xs" style={{ color: `${PARCHMENT}60` }}>
            Effective Date: February 1, 2026 &middot; Last Updated: February 18, 2026
          </p>
          <GoldOrnament className="mt-4" />
        </div>

        <FantasyPanel className="p-5 md:p-8">
          <p className="text-xs md:text-sm leading-relaxed mb-6" style={{ color: `${PARCHMENT}80` }}>
            Project Lumi ("we", "us", "our") operates the Foxy Adventure application (the "Service"),
            accessible at <strong style={{ color: GOLD_LIGHT }}>foxy.projectlumi.org</strong>.
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information
            when you use our Service. We are committed to protecting the privacy of children and families,
            and we comply with Malaysia's Personal Data Protection Act 2010 (PDPA).
          </p>

          <Section title="1. Information We Collect">
            <p><strong style={{ color: GOLD_LIGHT }}>Parent/Guardian Information:</strong> Name, email address, phone number (optional), and account credentials when you register.</p>
            <p><strong style={{ color: GOLD_LIGHT }}>Child Information:</strong> Child's first name, age, and assessment responses (answers to educational questions). We do not collect sensitive personal data such as photos, precise location, or government identifiers from children.</p>
            <p><strong style={{ color: GOLD_LIGHT }}>Payment Information:</strong> Subscription purchases are processed by Stripe. We do not store credit card numbers, CVVs, or full card details on our servers. Stripe's privacy policy governs payment data handling.</p>
            <p><strong style={{ color: GOLD_LIGHT }}>Usage Data:</strong> We collect anonymized analytics data including pages visited, features used, device type, and browser information to improve the Service.</p>
            <p><strong style={{ color: GOLD_LIGHT }}>Kindergarten Staff Information:</strong> If you register as a kindergarten administrator, we collect your name, email, school name, and contact details for institutional account management.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use collected information to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Provide, operate, and maintain the Service</li>
              <li>Generate educational readiness assessments and reports for your child</li>
              <li>Process subscription payments via Stripe</li>
              <li>Send transactional communications (e.g., purchase confirmations, account notifications)</li>
              <li>Improve and personalize the user experience</li>
              <li>Respond to customer support inquiries</li>
              <li>Comply with legal obligations under Malaysian law</li>
            </ul>
          </Section>

          <Section title="3. Children's Privacy">
            <p>
              Foxy Adventure is designed for use by children aged 4-7 under direct parental or guardian supervision.
              We take children's privacy very seriously:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Child accounts can only be created by a registered parent or guardian</li>
              <li>We collect the minimum data necessary to provide educational assessments (first name, age, answers)</li>
              <li>We do not display advertisements to children</li>
              <li>We do not sell or share children's personal data with third parties for marketing purposes</li>
              <li>Assessment data is used solely for generating educational reports for the parent/guardian</li>
              <li>Parents may request deletion of their child's data at any time (see Section 8)</li>
            </ul>
          </Section>

          <Section title="4. Data Storage and Security">
            <p>
              Your data is stored securely using Supabase infrastructure with encryption at rest and in transit (TLS 1.2+).
              Access to personal data is restricted to authorized personnel only. We implement industry-standard security measures
              including:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Encrypted database storage</li>
              <li>Secure authentication with PKCE flow</li>
              <li>Role-based access controls</li>
              <li>Regular security reviews</li>
            </ul>
          </Section>

          <Section title="5. Third-Party Services">
            <p>We use the following third-party services:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong style={{ color: GOLD_LIGHT }}>Supabase</strong> — Database hosting, authentication, and file storage</li>
              <li><strong style={{ color: GOLD_LIGHT }}>Stripe</strong> — Payment processing for subscriptions</li>
              <li><strong style={{ color: GOLD_LIGHT }}>Unsplash</strong> — Stock imagery used in the application interface</li>
            </ul>
            <p className="mt-2">
              Each third-party service has its own privacy policy governing their handling of data. We encourage you to review their respective policies.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain your personal data for as long as your account is active or as needed to provide the Service.
              Assessment data is retained to enable historical progress tracking. If you delete your account,
              we will delete your personal data within 30 days, except where retention is required by law.
            </p>
          </Section>

          <Section title="7. Cookies and Local Storage">
            <p>
              We use browser local storage (not tracking cookies) to maintain your login session, language preferences,
              and assessment progress. We do not use third-party advertising or tracking cookies.
            </p>
          </Section>

          <Section title="8. Your Rights Under PDPA">
            <p>Under Malaysia's Personal Data Protection Act 2010 (PDPA), you have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong style={{ color: GOLD_LIGHT }}>Access</strong> — Request a copy of the personal data we hold about you</li>
              <li><strong style={{ color: GOLD_LIGHT }}>Correction</strong> — Request correction of inaccurate or incomplete data</li>
              <li><strong style={{ color: GOLD_LIGHT }}>Withdrawal</strong> — Withdraw consent for data processing at any time</li>
              <li><strong style={{ color: GOLD_LIGHT }}>Deletion</strong> — Request deletion of your and your child's personal data</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, please contact us at <strong style={{ color: GOLD_LIGHT }}>support@projectlumi.org</strong>.
              We will respond within 21 days as required by the PDPA.
            </p>
          </Section>

          <Section title="9. Data Disclosure">
            <p>We do not sell your personal data. We may disclose data only:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>To comply with legal obligations or lawful government requests</li>
              <li>To protect the rights, property, or safety of Project Lumi, our users, or the public</li>
              <li>To our authorized service providers (Supabase, Stripe) strictly for operating the Service</li>
              <li>To a kindergarten institution, only if the parent has explicitly linked their child's account to that institution</li>
            </ul>
          </Section>

          <Section title="10. International Data Transfers">
            <p>
              Our infrastructure providers (Supabase, Stripe) may process data in regions outside Malaysia.
              We ensure that appropriate safeguards are in place to protect your data in compliance with the PDPA.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify registered users via email
              of any material changes. The "Last Updated" date at the top of this page reflects the most recent revision.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p>If you have any questions about this Privacy Policy or your personal data, please contact us:</p>
            <div className="mt-2 p-3 rounded-lg" style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}15` }}>
              <p><strong style={{ color: GOLD_LIGHT }}>Project Lumi</strong></p>
              <p>Email: support@projectlumi.org</p>
              <p>Website: projectlumi.org</p>
              <p>Country: Malaysia</p>
            </div>
          </Section>
        </FantasyPanel>

        <div className="mt-8">
          <FantasyFooter />
        </div>
      </div>
    </div>
  );
}
