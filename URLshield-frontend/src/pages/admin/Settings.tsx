import React, { useState } from 'react';
import { Save, Users, Bell, Shield, Database, Tag, Image, Globe } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { KeywordManager } from '../../components/KeywordManager';
import { TemplateManager } from '../../components/TemplateManager';
import { BrandDomainManager } from '../../components/BrandDomainManager';

export const Settings: React.FC = () => {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [alertThreshold, setAlertThreshold] = useState('medium');
  const [autoScan, setAutoScan] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'keywords' | 'domains' | 'templates'>('general');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text mb-2">Settings</h1>
        <p className="text-text-secondary">Manage system configuration and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 font-medium transition-all duration-150 border-b-2 ${
            activeTab === 'general'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield size={16} />
            General Settings
          </div>
        </button>
        <button
          onClick={() => setActiveTab('keywords')}
          className={`px-4 py-2 font-medium transition-all duration-150 border-b-2 ${
            activeTab === 'keywords'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          <div className="flex items-center gap-2">
            <Tag size={16} />
            ML Keywords
          </div>
        </button>
        <button
          onClick={() => setActiveTab('domains')}
          className={`px-4 py-2 font-medium transition-all duration-150 border-b-2 ${
            activeTab === 'domains'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          <div className="flex items-center gap-2">
            <Globe size={16} />
            Brand Domains
          </div>
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 font-medium transition-all duration-150 border-b-2 ${
            activeTab === 'templates'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          <div className="flex items-center gap-2">
            <Image size={16} />
            Brand Templates
          </div>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'keywords' ? (
        <KeywordManager />
      ) : activeTab === 'domains' ? (
        <BrandDomainManager />
      ) : activeTab === 'templates' ? (
        <TemplateManager />
      ) : (
        <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-6">
          <div>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell size={20} className="text-primary" />
                <h3 className="text-lg font-semibold text-text">Notifications</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text">Email Notifications</p>
                  <p className="text-sm text-text-secondary">Receive alerts via email</p>
                </div>
                <button
                  onClick={() => setEmailNotifications(!emailNotifications)}
                  className={`relative w-12 h-6 rounded-full transition-all duration-200 ${
                    emailNotifications ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                      emailNotifications ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text">Auto-Scan Domains</p>
                  <p className="text-sm text-text-secondary">Automatically scan new domains</p>
                </div>
                <button
                  onClick={() => setAutoScan(!autoScan)}
                  className={`relative w-12 h-6 rounded-full transition-all duration-200 ${
                    autoScan ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                      autoScan ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block font-medium text-text mb-2">Alert Threshold</label>
                <select
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-4 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-150"
                >
                  <option value="low">Low - All detections</option>
                  <option value="medium">Medium - Suspected and above</option>
                  <option value="high">High - Confirmed threats only</option>
                </select>
              </div>
            </CardContent>
          </div>

          <div>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield size={20} className="text-success" />
                <h3 className="text-lg font-semibold text-text">Security</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input label="API Key" type="password" value="••••••••••••••••" readOnly />
              <Input label="Webhook URL" placeholder="https://your-webhook.com/endpoint" />
              <Button variant="secondary" size="sm">
                Regenerate API Key
              </Button>
            </CardContent>
          </div>

          <div>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database size={20} className="text-warning" />
                <h3 className="text-lg font-semibold text-text">Data Management</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-bg rounded-lg border border-border">
                <div>
                  <p className="font-medium text-text">Evidence Retention</p>
                  <p className="text-sm text-text-secondary">Keep evidence for 90 days</p>
                </div>
                <Button variant="secondary" size="sm">
                  Configure
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-bg rounded-lg border border-border">
                <div>
                  <p className="font-medium text-text">Export Data</p>
                  <p className="text-sm text-text-secondary">Download all collected data</p>
                </div>
                <Button variant="secondary" size="sm">
                  Export
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users size={20} className="text-primary" />
                <h3 className="text-lg font-semibold text-text">Team</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: 'Admin User', role: 'Administrator', status: 'active' },
                { name: 'Security Analyst', role: 'Analyst', status: 'active' },
                { name: 'Guest User', role: 'Viewer', status: 'inactive' }
              ].map((member, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-bg rounded-lg border border-border hover:border-primary/50 transition-all duration-150"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text">{member.name}</p>
                    <p className="text-xs text-text-secondary">{member.role}</p>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      member.status === 'active' ? 'bg-success' : 'bg-text-secondary'
                    }`}
                  />
                </div>
              ))}
              <Button variant="primary" size="sm" className="w-full">
                Invite Member
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="text-center py-6">
              <Shield size={48} className="mx-auto mb-3 text-primary" />
              <h3 className="font-bold text-text mb-1">Enterprise Plan</h3>
              <p className="text-sm text-text-secondary mb-4">Unlimited domains & alerts</p>
              <Button variant="primary" size="sm" className="w-full">
                Upgrade Plan
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary">Cancel</Button>
        <Button variant="primary">
          <Save size={16} className="mr-2" />
          Save Changes
        </Button>
      </div>
      </div>
      )}
    </div>
  );
};
