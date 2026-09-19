import React, { useState, useEffect } from 'react';
import { Plus, X, Tag, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardContent } from './Card';
import { Button } from './Button';
import { Input } from './Input';

interface KeywordData {
  brand_keywords: string[];
  misleading_keywords: string[];
  brand_count: number;
  misleading_count: number;
  last_updated: string;
}

export const KeywordManager: React.FC = () => {
  const [keywords, setKeywords] = useState<KeywordData>({
    brand_keywords: [],
    misleading_keywords: [],
    brand_count: 0,
    misleading_count: 0,
    last_updated: new Date().toISOString()
  });
  
  const [newBrandKeyword, setNewBrandKeyword] = useState('');
  const [newMisleadingKeyword, setNewMisleadingKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const API_URL = 'http://localhost:8080';
  const API_KEY = 'lAm3493F0AW0p-ARuvNYENhcYSY-RxNio5Q-o8p15oc'; // Use the production API key

  useEffect(() => {
    fetchKeywords();
  }, []);

  const fetchKeywords = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/keywords`, {
        headers: { 'X-API-Key': API_KEY }
      });
      
      if (response.ok) {
        const data = await response.json();
        setKeywords(data);
      } else {
        showMessage('error', 'Failed to load keywords');
      }
    } catch (error) {
      showMessage('error', 'Error connecting to server');
    } finally {
      setIsLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const addBrandKeyword = async () => {
    if (!newBrandKeyword.trim()) return;
    
    const keyword = newBrandKeyword.trim();
    
    try {
      // Add keyword
      const response = await fetch(`${API_URL}/keywords/brand/add?keyword=${encodeURIComponent(keyword)}`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY }
      });
      
      const data = await response.json();
      if (data.success) {
        showMessage('success', `Added: ${keyword}`);
        setNewBrandKeyword('');
        fetchKeywords();
        
        // Auto-capture template if keyword looks like a domain
        if (keyword.includes('.')) {
          captureTemplate(keyword);
        }
      } else {
        showMessage('error', data.message);
      }
    } catch (error) {
      showMessage('error', 'Failed to add keyword');
    }
  };
  
  const captureTemplate = async (domain: string) => {
    try {
      showMessage('success', `Capturing screenshot for ${domain}...`);
      
      const response = await fetch(`${API_URL}/templates/capture?domain=${encodeURIComponent(domain)}`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY }
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        showMessage('success', `✓ Screenshot captured for ${domain}`);
      } else if (result.status === 'exists') {
        showMessage('success', `✓ Template already exists for ${domain}`);
      } else {
        console.error('Template capture failed:', result.message);
      }
    } catch (error) {
      console.error('Error capturing template:', error);
    }
  };

  const removeBrandKeyword = async (keyword: string) => {
    try {
      const response = await fetch(`${API_URL}/keywords/brand/remove?keyword=${encodeURIComponent(keyword)}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': API_KEY }
      });
      
      const data = await response.json();
      if (data.success) {
        showMessage('success', `Removed: ${keyword}`);
        fetchKeywords();
      }
    } catch (error) {
      showMessage('error', 'Failed to remove keyword');
    }
  };

  const addMisleadingKeyword = async () => {
    if (!newMisleadingKeyword.trim()) return;
    
    try {
      const response = await fetch(`${API_URL}/keywords/misleading/add?keyword=${encodeURIComponent(newMisleadingKeyword.trim())}`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY }
      });
      
      const data = await response.json();
      if (data.success) {
        showMessage('success', `Added: ${newMisleadingKeyword}`);
        setNewMisleadingKeyword('');
        fetchKeywords();
      } else {
        showMessage('error', data.message);
      }
    } catch (error) {
      showMessage('error', 'Failed to add keyword');
    }
  };

  const removeMisleadingKeyword = async (keyword: string) => {
    try {
      const response = await fetch(`${API_URL}/keywords/misleading/remove?keyword=${encodeURIComponent(keyword)}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': API_KEY }
      });
      
      const data = await response.json();
      if (data.success) {
        showMessage('success', `Removed: ${keyword}`);
        fetchKeywords();
      }
    } catch (error) {
      showMessage('error', 'Failed to remove keyword');
    }
  };

  return (
    <div className="space-y-6">
      {/* Message Toast */}
      {message && (
        <div className={`fixed top-20 right-8 z-50 px-4 py-3 rounded-lg shadow-lg ${
          message.type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text">Keyword Management</h2>
          <p className="text-sm text-text-secondary mt-1">
            Configure brand and misleading keywords for ML feature extraction
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchKeywords} disabled={isLoading}>
          <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brand Keywords */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag size={20} className="text-primary" />
                <h3 className="text-lg font-semibold text-text">Brand Keywords</h3>
              </div>
              <span className="text-sm text-text-secondary">
                {keywords.brand_count} keywords
              </span>
            </div>
            <p className="text-sm text-text-secondary mt-2">
              Known brand names to detect in URLs (e.g., paypal, amazon, google)
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Add New */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter brand name..."
                value={newBrandKeyword}
                onChange={(e) => setNewBrandKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addBrandKeyword()}
              />
              <Button variant="primary" size="sm" onClick={addBrandKeyword}>
                <Plus size={16} />
              </Button>
            </div>

            {/* Keywords List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {keywords.brand_keywords.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">
                  <Tag size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No brand keywords configured</p>
                  <p className="text-sm">Add keywords to enable brand detection</p>
                </div>
              ) : (
                keywords.brand_keywords.map((keyword, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-bg rounded-lg border border-border hover:border-primary/50 transition-all duration-150"
                  >
                    <span className="text-text font-medium">{keyword}</span>
                    <button
                      onClick={() => removeBrandKeyword(keyword)}
                      className="text-danger hover:bg-danger/10 p-1 rounded transition-all duration-150"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Misleading Keywords */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-warning" />
                <h3 className="text-lg font-semibold text-text">Misleading Keywords</h3>
              </div>
              <span className="text-sm text-text-secondary">
                {keywords.misleading_count} keywords
              </span>
            </div>
            <p className="text-sm text-text-secondary mt-2">
              Suspicious words often used in phishing (e.g., login, verify, urgent)
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Add New */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter misleading keyword..."
                value={newMisleadingKeyword}
                onChange={(e) => setNewMisleadingKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addMisleadingKeyword()}
              />
              <Button variant="primary" size="sm" onClick={addMisleadingKeyword}>
                <Plus size={16} />
              </Button>
            </div>

            {/* Keywords List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {keywords.misleading_keywords.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">
                  <AlertTriangle size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No misleading keywords configured</p>
                  <p className="text-sm">Add keywords to detect suspicious URLs</p>
                </div>
              ) : (
                keywords.misleading_keywords.map((keyword, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-bg rounded-lg border border-border hover:border-warning/50 transition-all duration-150"
                  >
                    <span className="text-text font-medium">{keyword}</span>
                    <button
                      onClick={() => removeMisleadingKeyword(keyword)}
                      className="text-danger hover:bg-danger/10 p-1 rounded transition-all duration-150"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Tag size={20} className="text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-text mb-1">How Keywords Work</h4>
              <ul className="text-sm text-text-secondary space-y-1">
                <li>• <strong>Brand Keywords</strong>: Used to detect if a known brand appears in suspicious URLs</li>
                <li>• <strong>Misleading Keywords</strong>: Words that create urgency or trick users (e.g., "verify account")</li>
                <li>• Keywords are case-insensitive and apply immediately to new URL scans</li>
                <li>• Last updated: {new Date(keywords.last_updated).toLocaleString()}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
