import React, { useState, useEffect } from 'react';
import { Save, Upload, MapPin, Building2, Image, Mail, Phone, MessageCircle, Copy, Check, Users } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getFreshAdminToken } from '../../utils/supabase-client';
import type { BrandingSettings } from '../../types/app-types';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

interface SettingsPageProps {
  brandingSettings: BrandingSettings;
  setBrandingSettings: (settings: BrandingSettings) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ brandingSettings, setBrandingSettings }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Resolve school code: localStorage first, then server fallback
  const [schoolCode, setSchoolCode] = useState<string>(localStorage.getItem('school_short_code') || '');
  const [schoolUrl, setSchoolUrl] = useState<string>(localStorage.getItem('school_kindergarten_url') || '');
  const [isFetchingCode, setIsFetchingCode] = useState(!localStorage.getItem('school_short_code'));

  useEffect(() => {
    if (localStorage.getItem('school_short_code')) {
      setIsFetchingCode(false);
      return;
    }
    const fetchCode = async () => {
      try {
        const token = await getFreshAdminToken();
        if (!token) return;
        const res = await fetch(`${API_BASE}/auth/session`, {
          headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-User-Token': `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const code = data.school?.short_code || '';
        const url = data.school?.kindergarten_url || '';
        if (code) { localStorage.setItem('school_short_code', code); setSchoolCode(code); }
        if (url)  { localStorage.setItem('school_kindergarten_url', url); setSchoolUrl(url); }
      } catch (err) {
        console.warn('[SETTINGS] Could not fetch school code:', err);
      } finally {
        setIsFetchingCode(false);
      }
    };
    fetchCode();
  }, []);

  const handleCopyCode = () => {
    if (!schoolCode) return;
    navigator.clipboard.writeText(schoolCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = schoolCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = await getFreshAdminToken();
      if (!token) {
        toast.error('Session expired. Please log in again.');
        setIsSaving(false);
        return;
      }

      const res = await fetch(`${API_BASE}/school/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${token}`,
        },
        body: JSON.stringify({
          school_name: brandingSettings.schoolName,
          logo_url: brandingSettings.logoUrl,
          primary_color: brandingSettings.primaryColor,
          email: brandingSettings.email,
          phone: brandingSettings.phone,
          whatsapp_no: brandingSettings.whatsappNo,
          address: brandingSettings.address,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('[SETTINGS] Save error:', data);
        toast.error(data.error || 'Failed to save settings');
        return;
      }

      toast.success('Settings saved!');
    } catch (err: any) {
      console.error('[SETTINGS] Save error:', err);
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setTimeout(() => setIsSaving(false), 600);
    }
  };

  const handleLogoUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image must be under 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setBrandingSettings({ ...brandingSettings, logoUrl: dataUrl });
        toast.success('Logo uploaded! Remember to click Save Changes.');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const inputClass = "w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-all";

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your kindergarten profile and contact information</p>
      </div>

      <div className="space-y-8">

        {/* ── School Connect Code ── */}
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-indigo-700">Parent Connect Code</h3>
          </div>
          <p className="text-xs text-indigo-500 mb-4 leading-relaxed">
            Share this code with parents so they can link their Foxy app to your class. Once connected, you can view their child's assessment results and activity in the <strong>Students</strong> tab.
          </p>

          {/* Code display */}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center justify-between bg-white border-2 border-indigo-200 rounded-xl px-4 py-3 min-h-[54px]">
              {isFetchingCode ? (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-6 bg-indigo-100 rounded animate-pulse" />
                </div>
              ) : schoolCode ? (
                <>
                  <span className="text-2xl font-black tracking-[0.2em] text-indigo-700 font-mono select-all">
                    {schoolCode}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      codeCopied
                        ? 'bg-green-100 text-green-700'
                        : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                    }`}
                  >
                    {codeCopied ? (
                      <><Check className="w-3.5 h-3.5" /> Copied!</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> Copy</>
                    )}
                  </button>
                </>
              ) : (
                <span className="text-sm text-indigo-300 italic">Code not assigned — contact support</span>
              )}
            </div>
          </div>

          {schoolUrl && (
            <p className="text-[11px] text-indigo-400 mt-2.5">
              Test URL: <span className="font-mono">/t/{schoolUrl}</span>
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Logo */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <Image className="w-4 h-4 text-gray-400" />
            School Logo
          </label>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden flex-shrink-0">
              {brandingSettings.logoUrl ? (
                <img
                  src={brandingSettings.logoUrl}
                  alt="School logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="w-8 h-8 text-gray-300" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleLogoUpload}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                {brandingSettings.logoUrl ? 'Change Logo' : 'Upload Logo'}
              </button>
              <p className="text-xs text-gray-400">PNG or JPG, up to 2MB. Recommended: 256 × 256 px square — logo will auto-crop to a circle.</p>
              {brandingSettings.logoUrl && (
                <button
                  onClick={() => {
                    setBrandingSettings({ ...brandingSettings, logoUrl: '' });
                    toast.success('Logo removed');
                  }}
                  className="text-xs text-red-500 hover:text-red-700 font-medium text-left transition-colors"
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Kindergarten Name */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            Kindergarten Name
          </label>
          <input
            type="text"
            value={brandingSettings.schoolName}
            onChange={(e) => setBrandingSettings({ ...brandingSettings, schoolName: e.target.value })}
            placeholder="e.g. Tadika Little Stars"
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1.5">This name appears on reports shared with parents.</p>
        </div>

        {/* Address */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            Address
          </label>
          <textarea
            value={brandingSettings.address}
            onChange={(e) => setBrandingSettings({ ...brandingSettings, address: e.target.value })}
            rows={3}
            placeholder="e.g. 123 Jalan Pendidikan, Taman Ilmu, 50000 Kuala Lumpur"
            className={`${inputClass} resize-none`}
          />
          <p className="text-xs text-gray-400 mt-1.5">Displayed on public reports for parents.</p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Contact Information */}
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-1">Contact Information</p>
          <p className="text-xs text-gray-400 mb-5">These details appear on reports shared with parents so they can reach you.</p>

          <div className="space-y-5">
            {/* Email */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 text-gray-400" />
                Email
              </label>
              <input
                type="email"
                value={brandingSettings.email}
                onChange={(e) => setBrandingSettings({ ...brandingSettings, email: e.target.value })}
                placeholder="e.g. info@tadikalittlestars.com"
                className={inputClass}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 text-gray-400" />
                Phone Number
              </label>
              <input
                type="tel"
                value={brandingSettings.phone}
                onChange={(e) => setBrandingSettings({ ...brandingSettings, phone: e.target.value })}
                placeholder="e.g. 03-1234 5678"
                className={inputClass}
              />
            </div>

            {/* WhatsApp */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MessageCircle className="w-4 h-4 text-gray-400" />
                WhatsApp Number
              </label>
              <input
                type="tel"
                value={brandingSettings.whatsappNo}
                onChange={(e) => setBrandingSettings({ ...brandingSettings, whatsappNo: e.target.value })}
                placeholder="e.g. 012-345 6789"
                className={inputClass}
              />
              <p className="text-xs text-gray-400 mt-1.5">Parents can tap to message you directly from the report.</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Save */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">All changes are saved to the server and apply to new reports.</p>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};