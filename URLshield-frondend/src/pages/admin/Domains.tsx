import React, { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Card, CardContent } from '../../components/Card';
import { Input } from '../../components/Input';
import { ScorePill } from '../../components/ScorePill';
import { Chip } from '../../components/Chip';

interface Domain {
  id: string;
  domain: string;
  score: 'phishing' | 'suspected' | 'clean';
  cseSignals: string[];
  lastChecked: string;
  status: 'active' | 'monitoring' | 'resolved';
}

const mockDomains: Domain[] = [
  {
    id: 'DOM-001',
    domain: 'fake-amazon-login.com',
    score: 'phishing',
    cseSignals: ['Typosquatting', 'Credential Harvesting', 'SSL Anomaly'],
    lastChecked: '5m ago',
    status: 'active'
  },
  {
    id: 'DOM-002',
    domain: 'updates-apple-verify.net',
    score: 'suspected',
    cseSignals: ['Brand Impersonation', 'Recent Registration'],
    lastChecked: '12m ago',
    status: 'monitoring'
  },
  {
    id: 'DOM-003',
    domain: 'secure-banking-portal.info',
    score: 'phishing',
    cseSignals: ['Domain Squatting', 'Suspicious Hosting', 'Fake Login'],
    lastChecked: '20m ago',
    status: 'active'
  },
  {
    id: 'DOM-004',
    domain: 'trusted-vendor.com',
    score: 'clean',
    cseSignals: ['Verified SSL', 'Established History', 'Clean Reputation'],
    lastChecked: '1h ago',
    status: 'resolved'
  },
  {
    id: 'DOM-005',
    domain: 'crypto-wallet-update.org',
    score: 'suspected',
    cseSignals: ['Crypto Scam', 'Malware Distribution'],
    lastChecked: '2h ago',
    status: 'monitoring'
  }
];

export const Domains: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScore, setFilterScore] = useState<string>('all');

  const filteredDomains = mockDomains.filter(domain => {
    const matchesSearch = domain.domain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterScore === 'all' || domain.score === filterScore;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text mb-2">Domains</h1>
        <p className="text-text-secondary">Monitor and analyze suspicious domains</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="bg-danger/5 border-danger/20">
          <CardContent className="text-center py-6">
            <p className="text-3xl font-bold text-danger mb-1">
              {mockDomains.filter(d => d.score === 'phishing').length}
            </p>
            <p className="text-sm text-text-secondary">Phishing Detected</p>
          </CardContent>
        </Card>
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="text-center py-6">
            <p className="text-3xl font-bold text-warning mb-1">
              {mockDomains.filter(d => d.score === 'suspected').length}
            </p>
            <p className="text-sm text-text-secondary">Suspected Threats</p>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/20">
          <CardContent className="text-center py-6">
            <p className="text-3xl font-bold text-success mb-1">
              {mockDomains.filter(d => d.score === 'clean').length}
            </p>
            <p className="text-sm text-text-secondary">Clean Domains</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="text-center py-6">
            <p className="text-3xl font-bold text-primary mb-1">{mockDomains.length}</p>
            <p className="text-sm text-text-secondary">Total Monitored</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4 space-y-4">
          <Input
            placeholder="Search domains..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            icon={<Search size={18} />}
          />
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-text-secondary" />
            <span className="text-sm text-text-secondary">Filter by score:</span>
            <div className="flex gap-2">
              {['all', 'phishing', 'suspected', 'clean'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setFilterScore(filter)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
                    filterScore === filter
                      ? 'bg-primary text-white'
                      : 'bg-surface text-text-secondary hover:text-text border border-border'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        {filteredDomains.map((domain, idx) => (
          <Card
            key={domain.id}
            hover
            className="animate-slide-up"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <CardContent className="py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-text font-mono">{domain.domain}</h3>
                    <ScorePill score={domain.score} />
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        domain.status === 'active'
                          ? 'bg-danger/10 text-danger'
                          : domain.status === 'monitoring'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-success/10 text-success'
                      }`}
                    >
                      {domain.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <span className="font-medium">ID:</span>
                      <span>{domain.id}</span>
                      <span className="mx-2">•</span>
                      <span className="font-medium">Last Checked:</span>
                      <span>{domain.lastChecked}</span>
                    </div>

                    <div>
                      <p className="text-xs text-text-secondary mb-2 font-medium">CSE Signals:</p>
                      <div className="flex flex-wrap gap-2">
                        {domain.cseSignals.map((signal, idx) => (
                          <Chip key={idx} label={signal} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
