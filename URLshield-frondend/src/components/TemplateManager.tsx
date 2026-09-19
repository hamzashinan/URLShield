import React, { useState, useEffect } from 'react';
import { Image, RefreshCw, Eye, Camera, Loader } from 'lucide-react';
import { Card, CardHeader, CardContent } from './Card';
import { Button } from './Button';
import { Input } from './Input';

interface Template {
  brand_name: string;
  domain: string;
  screenshot_path: string;
  captured_at: string;
  size_kb: number;
  imageUrl?: string; // Blob URL for the image
}

export const TemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const API_BASE = 'http://localhost:8080';
  const API_KEY = 'lAm3493F0AW0p-ARuvNYENhcYSY-RxNio5Q-o8p15oc'; // Use the production API key

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/templates`, {
        headers: {
          'X-API-Key': API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      const templatesData = data.templates || [];
      
      // Fetch images as blobs for each template
      const templatesWithImages = await Promise.all(
        templatesData.map(async (template: Template) => {
          try {
            const imgResponse = await fetch(
              `${API_BASE}/templates/${template.brand_name}/screenshot.png`,
              {
                headers: { 'X-API-Key': API_KEY },
              }
            );
            if (imgResponse.ok) {
              const blob = await imgResponse.blob();
              const imageUrl = URL.createObjectURL(blob);
              return { ...template, imageUrl };
            }
          } catch (error) {
            console.error(`Failed to load image for ${template.brand_name}:`, error);
          }
          return template;
        })
      );
      
      setTemplates(templatesWithImages);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Capture new template
  const handleCaptureTemplate = async () => {
    if (!newDomain.trim()) return;

    try {
      setCapturing(true);
      const response = await fetch(`${API_BASE}/templates/capture?domain=${encodeURIComponent(newDomain)}`, {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
        },
      });

      const result = await response.json();

      if (result.status === 'success') {
        setNewDomain('');
        await fetchTemplates();
      } else {
        alert(result.message || 'Failed to capture template');
      }
    } catch (error) {
      console.error('Error capturing template:', error);
      alert('Failed to capture template');
    } finally {
      setCapturing(false);
    }
  };

  // Refresh template
  const handleRefreshTemplate = async (domain: string) => {
    try {
      const response = await fetch(`${API_BASE}/templates/refresh?domain=${encodeURIComponent(domain)}`, {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
        },
      });

      const result = await response.json();

      if (result.status === 'success') {
        await fetchTemplates();
      } else {
        alert(result.message || 'Failed to refresh template');
      }
    } catch (error) {
      console.error('Error refreshing template:', error);
      alert('Failed to refresh template');
    }
  };

  // Preview template
  const handlePreviewTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="text-primary" size={24} />
              <div>
                <h2 className="text-xl font-semibold text-text">Brand Templates</h2>
                <p className="text-sm text-text-secondary">
                  Manage brand website screenshots for visual phishing detection
                </p>
              </div>
            </div>
            <Button
              onClick={fetchTemplates}
              variant="ghost"
              size="sm"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Capture New Template */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-text">Capture New Template</h3>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Enter domain (e.g., hdfcbank.com)"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCaptureTemplate()}
              disabled={capturing}
            />
            <Button
              onClick={handleCaptureTemplate}
              disabled={!newDomain.trim() || capturing}
            >
              {capturing ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Capturing...
                </>
              ) : (
                <>
                  <Camera size={16} />
                  Capture
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-text-secondary mt-2">
            Enter a brand domain to capture its screenshot for SSIM comparison
          </p>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text">
              Available Templates ({templates.length})
            </h3>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={32} className="animate-spin text-primary" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <Image size={48} className="mx-auto text-text-secondary mb-4" />
              <p className="text-text-secondary">No templates captured yet</p>
              <p className="text-sm text-text-secondary mt-2">
                Add a domain above to capture your first template
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <div
                  key={template.brand_name}
                  className="border border-border rounded-lg p-4 hover:border-primary transition-colors"
                >
                  <div className="aspect-video bg-surface-dark rounded-lg mb-3 overflow-hidden cursor-pointer"
                    onClick={() => handlePreviewTemplate(template)}
                  >
                    <img
                      src={template.imageUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'}
                      alt={template.domain}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-text truncate">{template.domain}</h4>
                    <div className="flex items-center justify-between text-xs text-text-secondary">
                      <span>{(template.size_kb).toFixed(1)} KB</span>
                      <span>{new Date(template.captured_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreviewTemplate(template)}
                        className="flex-1"
                      >
                        <Eye size={14} />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshTemplate(template.domain)}
                        className="flex-1"
                      >
                        <RefreshCw size={14} />
                        Refresh
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {showPreview && selectedTemplate && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-surface rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-text">{selectedTemplate.domain}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                >
                  Close
                </Button>
              </div>
              <img
                src={selectedTemplate.imageUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'}
                alt={selectedTemplate.domain}
                className="w-full rounded-lg border border-border"
              />
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-secondary">Brand:</span>
                  <span className="ml-2 text-text font-medium">{selectedTemplate.brand_name}</span>
                </div>
                <div>
                  <span className="text-text-secondary">Size:</span>
                  <span className="ml-2 text-text font-medium">{selectedTemplate.size_kb.toFixed(1)} KB</span>
                </div>
                <div>
                  <span className="text-text-secondary">Captured:</span>
                  <span className="ml-2 text-text font-medium">
                    {new Date(selectedTemplate.captured_at).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary">Path:</span>
                  <span className="ml-2 text-text font-medium font-mono text-xs">
                    {selectedTemplate.screenshot_path}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
