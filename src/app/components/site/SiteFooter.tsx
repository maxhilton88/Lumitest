/**
 * SiteFooter.tsx — Shared minimalist footer for public pages
 * 
 * Contains: Product links, Company links, Contact info
 */
import React from 'react';
import { Link } from 'react-router';
import { MessageCircle } from 'lucide-react';

const PRODUCT_LINKS = [
  { label: 'Parents', href: '/parents' },
  { label: 'Kindergarten', href: '/kindergarten' },
  { label: 'AI Toy', href: '/ai-toy' },
  { label: 'Pricing', href: '/pricing' },
];

const COMPANY_LINKS = [
  { label: 'About Us', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 bg-gray-950 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-[9px]">PL</span>
              </div>
              <span className="text-sm font-semibold text-gray-950 tracking-tight">
                Project Lumi
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
              Malaysia's KSSR readiness platform. Gamified assessments
              for children ages 4-12, built for Malaysian families and kindergartens.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-[11px] font-semibold text-gray-950 uppercase tracking-wider mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-[11px] font-semibold text-gray-950 uppercase tracking-wider mb-4">
              Company
            </h4>
            <ul className="space-y-2.5">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-[11px] font-semibold text-gray-950 uppercase tracking-wider mb-4">
              Contact
            </h4>
            <div className="space-y-3 text-xs text-gray-400">
              <p className="leading-relaxed">
                88, Jalan Raja Chulan,<br />
                Bukit Bintang, 50200<br />
                Kuala Lumpur, Malaysia
              </p>
              <a
                href="https://wa.me/60182793151"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <MessageCircle className="w-3 h-3" />
                +6018-2793151
              </a>
              <p>
                <a
                  href="mailto:hello@projectlumi.org"
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  hello@projectlumi.org
                </a>
              </p>
              <p className="text-gray-300">
                Mon - Fri: 8AM - 5PM
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-gray-300">
            &copy; {new Date().getFullYear()} Project Lumi. All rights reserved.
          </p>
          <p className="text-[11px] text-gray-300">
            Built in Malaysia for Malaysian families.
          </p>
        </div>
      </div>
    </footer>
  );
}
