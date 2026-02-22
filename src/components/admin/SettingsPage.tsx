import React, { useState } from 'react';
import { Save, Upload, MapPin, Building2, Image, Mail, Phone, MessageCircle } from 'lucide-react';
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
        {/* Logo */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <Image className="w-4 h-4 text-gray-400" />
            School Logo
          </label>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden flex-shrink-0">
              {brandingSettings.logoUrl ? (
                <img
                  src={brandingSettings.logoUrl}
                  alt="School logo"
                  className="w-full h-full object-contain"
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
              <p className="text-xs text-gray-400">PNG, JPG up to 2MB. Any size — logo will display at a fixed height.</p>
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