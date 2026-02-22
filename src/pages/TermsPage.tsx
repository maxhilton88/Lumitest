/**
 * TermsPage.tsx — Public Terms of Service
 *
 * Public route: /terms
 * No auth required — accessible by Stripe reviewers and visitors.
 * Malaysian-law-governed terms for a children's education SaaS.
 */
import React from 'react';
import { Link } from 'react-router';
import { ScrollText, ArrowLeft } from 'lucide-react';
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

export function TermsPage() {
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
            to="/privacy"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
            style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}15`, color: `${PARCHMENT}80` }}
          >
            Privacy Policy
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <ScrollText className="w-8 h-8 mx-auto mb-3" style={{ color: GOLD }} />
          <FantasyTitle size="md">Terms of Service</FantasyTitle>
          <p className="mt-3 text-xs" style={{ color: `${PARCHMENT}60` }}>
            Effective Date: February 1, 2026 &middot; Last Updated: February 18, 2026
          </p>
          <GoldOrnament className="mt-4" />
        </div>

        <FantasyPanel className="p-5 md:p-8">
          <p className="text-xs md:text-sm leading-relaxed mb-6" style={{ color: `${PARCHMENT}80` }}>
            Welcome to Foxy Adventure. These Terms of Service ("Terms") govern your access to and use of
            the Foxy Adventure application (the "Service") operated by Project Lumi ("we", "us", "our"),
            accessible at <strong style={{ color: GOLD_LIGHT }}>foxy.projectlumi.org</strong>.
            By accessing or using the Service, you agree to be bound by these Terms. If you do not agree,
            please do not use the Service.
          </p>

          <Section title="1. Service Description">
            <p>
              Foxy Adventure is a gamified educational assessment platform for children aged 4-7 years,
              designed to evaluate school readiness in alignment with Malaysia's KSSR (Kurikulum Standard Sekolah Rendah) curriculum.
              The Service includes:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Interactive assessment quests across multiple subjects (English, Bahasa Malaysia, Mathematics, Mandarin)</li>
              <li>Educational video library</li>
              <li>Detailed readiness reports and mastery dashboards</li>
              <li>Optional premium features via paid subscription plans</li>
              <li>Optional physical AI companion toy (FOXY-o1) bundled with Plan B</li>
            </ul>
          </Section>

          <Section title="2. Eligibility and Account Registration">
            <p>
              You must be at least 18 years of age (or the age of majority in your jurisdiction) to create an account
              and use the Service. By registering, you represent that you are the parent or legal guardian of any child
              using the Service under your account.
            </p>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities
              that occur under your account. You agree to notify us immediately of any unauthorized access.
            </p>
          </Section>

          <Section title="3. Free and Paid Plans">
            <p><strong style={{ color: GOLD_LIGHT }}>Free Tier:</strong> Includes one assessment per child, basic reports, free video content, and a shareable report link. No payment required.</p>
            <p><strong style={{ color: GOLD_LIGHT }}>Plan A (Digital):</strong> RM 365 per year. Includes unlimited assessments, full premium video library, practice mode, progress tracking, and priority support.</p>
            <p><strong style={{ color: GOLD_LIGHT }}>Plan B (Digital + Toy Bundle):</strong> RM 365 first year (introductory 50% discount, regular price RM 730). Includes everything in Plan A, plus the FOXY-o1 AI companion toy with free shipping within Malaysia. After the first year, renewal is RM 365/year for digital access only (the toy is yours to keep).</p>
            <p>
              All prices are in Malaysian Ringgit (MYR) and are inclusive of applicable taxes unless stated otherwise.
              We reserve the right to modify pricing with 30 days' advance notice to existing subscribers.
            </p>
          </Section>

          <Section title="4. Payment and Billing">
            <p>
              Subscription payments are processed securely through <strong style={{ color: GOLD_LIGHT }}>Stripe</strong>.
              By subscribing to a paid plan, you authorize us to charge the applicable fees to your payment method
              on a recurring annual basis.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Subscriptions renew automatically unless cancelled before the renewal date</li>
              <li>You may cancel your subscription at any time via the Stripe customer portal</li>
              <li>Upon cancellation, you retain access to paid features until the end of your current billing period</li>
              <li>No partial refunds are issued for unused portions of a billing period</li>
            </ul>
          </Section>

          <Section title="5. Refund Policy">
            <p>
              We offer a <strong style={{ color: GOLD_LIGHT }}>14-day refund window</strong> from the date of initial subscription purchase.
              If you are unsatisfied with the Service within this period, contact us at support@projectlumi.org
              for a full refund.
            </p>
            <p>
              For Plan B (toy bundle): Refunds for the digital subscription follow the same 14-day policy.
              The physical toy must be returned in unused condition within 14 days for a full refund.
              Shipping costs for returns are the responsibility of the customer.
            </p>
          </Section>

          <Section title="6. Physical Product (FOXY-o1 Toy)">
            <p>
              The FOXY-o1 AI companion toy included with Plan B is a physical product shipped to your provided address.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Free shipping within Peninsular and East Malaysia</li>
              <li>Estimated delivery: 7-14 business days after subscription confirmation</li>
              <li>International shipping available at additional cost</li>
              <li>The toy is yours to keep even if you cancel your digital subscription</li>
              <li>Warranty: 6 months from date of delivery for manufacturing defects</li>
            </ul>
          </Section>

          <Section title="7. Acceptable Use">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its systems</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Use automated tools (bots, scrapers) to access the Service without our written permission</li>
              <li>Share your account credentials with third parties or allow others to access your account</li>
              <li>Upload, transmit, or distribute harmful content including malware, viruses, or offensive material</li>
              <li>Reproduce, distribute, or publicly display content from the Service without authorization</li>
            </ul>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              All content, features, and functionality of the Service — including but not limited to
              text, graphics, logos, characters (including "Foxy" and related RPG characters), video content,
              assessment questions, software code, and the FOXY-o1 toy design — are the exclusive property of
              Project Lumi and are protected by Malaysian and international intellectual property laws.
            </p>
            <p>
              You are granted a limited, non-exclusive, non-transferable license to use the Service
              for personal, non-commercial educational purposes only.
            </p>
          </Section>

          <Section title="9. User-Generated Content">
            <p>
              Assessment responses and child data entered by users remain the property of the respective parent/guardian.
              By using the Service, you grant us a limited license to process this data solely for the purpose of
              generating educational reports and improving the Service.
            </p>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <p>
              The Service is provided "as is" and "as available" without warranties of any kind, either express or implied.
              While we strive to provide accurate educational assessments, we do not guarantee that assessment results
              constitute professional educational or psychological evaluations.
            </p>
            <p>
              Foxy Adventure is a supplementary educational tool and should not be used as the sole basis
              for educational decisions. We recommend consulting qualified educators for comprehensive evaluations.
            </p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>
              To the maximum extent permitted by Malaysian law, Project Lumi shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages arising out of or related
              to your use of the Service, including but not limited to loss of data, revenue, or profits.
            </p>
            <p>
              Our total liability for any claim arising out of these Terms shall not exceed the amount
              you have paid to us in the twelve (12) months preceding the claim.
            </p>
          </Section>

          <Section title="12. Termination">
            <p>
              We may suspend or terminate your access to the Service at any time for violation of these Terms
              or for any other reason at our discretion, with notice where practicable.
            </p>
            <p>
              You may terminate your account at any time by contacting us at support@projectlumi.org.
              Upon termination, your right to use the Service ceases immediately, and we will delete
              your data in accordance with our Privacy Policy.
            </p>
          </Section>

          <Section title="13. Modifications to Terms">
            <p>
              We reserve the right to modify these Terms at any time. Material changes will be communicated
              via email to registered users at least 14 days before they take effect. Your continued use
              of the Service after changes become effective constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="14. Governing Law and Dispute Resolution">
            <p>
              These Terms are governed by and construed in accordance with the laws of Malaysia.
              Any disputes arising out of or relating to these Terms or the Service shall be subject
              to the exclusive jurisdiction of the courts of Malaysia.
            </p>
            <p>
              Before initiating any legal proceedings, both parties agree to attempt to resolve disputes
              through good-faith negotiation for a period of 30 days.
            </p>
          </Section>

          <Section title="15. Severability">
            <p>
              If any provision of these Terms is found to be unenforceable or invalid by a court
              of competent jurisdiction, that provision shall be limited or eliminated to the minimum extent
              necessary, and the remaining provisions shall remain in full force and effect.
            </p>
          </Section>

          <Section title="16. Entire Agreement">
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you
              and Project Lumi regarding the use of the Service, and supersede all prior agreements
              and understandings.
            </p>
          </Section>

          <Section title="17. Contact Us">
            <p>If you have any questions about these Terms, please contact us:</p>
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
