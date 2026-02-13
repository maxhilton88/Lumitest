import React, { useState, useEffect } from 'react';
import { Save, Upload, Copy, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { sanitizeUrl, getUrlValidationMessage } from '../../utils/urlSanitizer';

interface SettingsPageProps {
  brandingSettings: {
    schoolName: string;
    logoUrl: string;
    primaryColor: string;
    kindergartenUrl: string;
    testPageBgColor: string;
    mapBackgroundImage: string;
    testBackgroundImage: string;
  };
  setBrandingSettings: (settings: {
    schoolName: string;
    logoUrl: string;
    primaryColor: string;
    kindergartenUrl: string;
    testPageBgColor: string;
    mapBackgroundImage: string;
    testBackgroundImage: string;
  }) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ brandingSettings, setBrandingSettings }) => {
  const [activeSection, setActiveSection] = useState('school');
  
  // Local state for school profile (not branding-related)
  const [contactEmail, setContactEmail] = useState('admin@littlestars.edu.my');
  const [contactPhone, setContactPhone] = useState('+60123456789');
  const [address, setAddress] = useState('123 Jalan Pendidikan, Kuala Lumpur');
  
  const [enableEmailNotifications, setEnableEmailNotifications] = useState(true);
  const [enableWhatsAppNotifications, setEnableWhatsAppNotifications] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);
  
  // URL validation state
  const [urlInput, setUrlInput] = useState(brandingSettings.kindergartenUrl);
  const [urlValidation, setUrlValidation] = useState<{
    valid: boolean;
    message: string;
    suggestions?: string[];
  }>({ valid: true, message: '' });
  
  // Validate URL when input changes
  useEffect(() => {
    const sanitized = sanitizeUrl(urlInput);
    const validation = getUrlValidationMessage(sanitized, brandingSettings.kindergartenUrl);
    setUrlValidation(validation);
    
    // Only update global state if valid
    if (validation.valid && sanitized !== brandingSettings.kindergartenUrl) {
      setBrandingSettings({ ...brandingSettings, kindergartenUrl: sanitized });
    }
  }, [urlInput]);
  
  const handleUrlChange = (value: string) => {
    setUrlInput(value);
  };
  
  const handleSuggestionClick = (suggestion: string) => {
    setUrlInput(suggestion);
  };

  const sections = [
    { id: 'school', icon: Save, label: 'School Profile' },
    { id: 'users', icon: Upload, label: 'User Management' },
    { id: 'notifications', icon: Copy, label: 'Notifications' },
    { id: 'branding', icon: Eye, label: 'Branding' },
    { id: 'security', icon: EyeOff, label: 'Security' }
  ];

  const handleSave = () => {
    toast.success('Settings saved successfully!');
  };

  return (
    <div className="h-full">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your school and account settings</p>
      </div>

      <div className="flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-6">
        {/* Section Navigation - horizontal scroll on mobile, sidebar on desktop */}
        <div className="md:col-span-3">
          <div className="bg-white border border-gray-200 rounded-lg p-1.5 md:p-2">
            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0">
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 md:flex-shrink md:w-full ${
                    activeSection === section.id
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <section.icon className="w-4 h-4 flex-shrink-0" />
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:col-span-9">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            
            {/* School Profile */}
            {activeSection === 'school' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">School Profile</h3>
                  <p className="text-sm text-gray-500 mb-6">Update your kindergarten's information</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">School Name</label>
                  <input
                    type="text"
                    value={brandingSettings.schoolName}
                    onChange={(e) => setBrandingSettings({ ...brandingSettings, schoolName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Phone</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                  />
                </div>

                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            )}

            {/* User Management */}
            {activeSection === 'users' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">User Management</h3>
                  <p className="text-sm text-gray-500 mb-6">Manage staff access to the dashboard</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Admin User</p>
                      <p className="text-xs text-gray-500">admin@littlestars.edu.my</p>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                      Owner
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Teacher Sarah</p>
                      <p className="text-xs text-gray-500">sarah@littlestars.edu.my</p>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium">
                      Viewer
                    </span>
                  </div>
                </div>

                <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors">
                  + Add New User
                </button>
              </div>
            )}

            {/* Notifications */}
            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
                  <p className="text-sm text-gray-500 mb-6">Choose how you want to be notified</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email Notifications</p>
                      <p className="text-xs text-gray-500 mt-1">Receive updates via email</p>
                    </div>
                    <button
                      onClick={() => setEnableEmailNotifications(!enableEmailNotifications)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        enableEmailNotifications ? 'bg-black' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          enableEmailNotifications ? 'left-6' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">WhatsApp Notifications</p>
                      <p className="text-xs text-gray-500 mt-1">Get alerts on WhatsApp</p>
                    </div>
                    <button
                      onClick={() => setEnableWhatsAppNotifications(!enableWhatsAppNotifications)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        enableWhatsAppNotifications ? 'bg-black' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          enableWhatsAppNotifications ? 'left-6' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Weekly Summary Report</p>
                      <p className="text-xs text-gray-500 mt-1">Receive weekly analytics summary</p>
                    </div>
                    <button
                      onClick={() => setWeeklyReport(!weeklyReport)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        weeklyReport ? 'bg-black' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          weeklyReport ? 'left-6' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Preferences
                </button>
              </div>
            )}

            {/* Branding */}
            {activeSection === 'branding' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Branding & Customization</h3>
                  <p className="text-sm text-gray-500 mb-6">Customize the look and feel</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">School Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-lg border-2 border-gray-200 flex items-center justify-center bg-gray-50">
                      {brandingSettings.logoUrl ? (
                        <img src={brandingSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <Save className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                      <Upload className="w-4 h-4" />
                      Upload Logo
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={brandingSettings.primaryColor}
                      onChange={(e) => setBrandingSettings({ ...brandingSettings, primaryColor: e.target.value })}
                      className="w-20 h-10 rounded border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandingSettings.primaryColor}
                      onChange={(e) => setBrandingSettings({ ...brandingSettings, primaryColor: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kindergarten URL</label>
                  <p className="text-xs text-gray-500 mb-2">Share this link with parents to access your test</p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-600">foxyadventure.com/</span>
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => handleUrlChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      placeholder="your-school-name"
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
                      foxyadventure.com/{brandingSettings.kindergartenUrl}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://foxyadventure.com/${brandingSettings.kindergartenUrl}`);
                        toast.success('URL copied to clipboard!');
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                      title="Copy URL"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => window.open(`https://foxyadventure.com/${brandingSettings.kindergartenUrl}`, '_blank')}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                  {/* URL Validation Feedback */}
                  {urlInput && (
                    <div className={`mt-3 p-3 rounded-lg border ${
                      urlValidation.valid 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        {urlValidation.valid ? (
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            urlValidation.valid ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {urlValidation.message}
                          </p>
                          
                          {/* URL Suggestions */}
                          {urlValidation.suggestions && urlValidation.suggestions.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-600 mb-1">Try these available URLs:</p>
                              <div className="flex flex-wrap gap-2">
                                {urlValidation.suggestions.map((suggestion, index) => (
                                  <button
                                    key={index}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-blue-500 hover:text-blue-600 transition-colors"
                                  >
                                    {suggestion}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Test Page Background Color</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={brandingSettings.testPageBgColor}
                      onChange={(e) => setBrandingSettings({ ...brandingSettings, testPageBgColor: e.target.value })}
                      className="w-20 h-10 rounded border border-gray-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandingSettings.testPageBgColor}
                      onChange={(e) => setBrandingSettings({ ...brandingSettings, testPageBgColor: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Map Background Image</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-lg border-2 border-gray-200 flex items-center justify-center bg-gray-50">
                      {brandingSettings.mapBackgroundImage ? (
                        <img src={brandingSettings.mapBackgroundImage} alt="Map Background" className="w-full h-full object-contain" />
                      ) : (
                        <Save className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                      <Upload className="w-4 h-4" />
                      Upload Image
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Test Background Image</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-lg border-2 border-gray-200 flex items-center justify-center bg-gray-50">
                      {brandingSettings.testBackgroundImage ? (
                        <img src={brandingSettings.testBackgroundImage} alt="Test Background" className="w-full h-full object-contain" />
                      ) : (
                        <Save className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                      <Upload className="w-4 h-4" />
                      Upload Image
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Branding
                </button>
              </div>
            )}

            {/* Security */}
            {activeSection === 'security' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>
                  <p className="text-sm text-gray-500 mb-6">Manage your account security</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
                  />
                </div>

                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Update Password
                </button>

                <div className="pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Two-Factor Authentication</h4>
                  <p className="text-sm text-gray-600 mb-4">Add an extra layer of security to your account</p>
                  <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                    Enable 2FA
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};