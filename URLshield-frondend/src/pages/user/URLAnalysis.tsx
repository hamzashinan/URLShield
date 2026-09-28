import React, { useEffect, useMemo, useState } from 'react';
import { Search, Loader, Download } from 'lucide-react';
import { Card, CardContent } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { MLFeaturesDisplay } from '../../components/MLFeaturesDisplay';
import { BatchUpload } from '../../components/BatchUpload';
import { BatchMonitor } from '../../components/BatchMonitor';
import { DomainDetailsCard } from '../../components/DomainDetailsCard';
import { classifySecurityRisk } from '../../lib/classification';
import type { DomainDetails, MLFeatures, MLPrediction, JobDetail } from '../../types/api';

type BrandMapping = {
  brand: string;
  domain: string;
};

interface URLAnalysisProps {
  /* no props */
}

interface AnalysisResult {
  domainDetails: DomainDetails | null;
  mlFeatures: MLFeatures;
  mlPrediction: MLPrediction;
}

export const URLAnalysis: React.FC<URLAnalysisProps> = () => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchUrls, setBatchUrls] = useState<string[]>([]);
  const [brandMappings, setBrandMappings] = useState<BrandMapping[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [brandLoadError, setBrandLoadError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<'main' | 'mini'>('main');
  const [analysisMode, setAnalysisMode] = useState<'url_only' | 'full_analysis'>('url_only');

  // Use Vite proxy for Docker compatibility
  const MAIN_API_URL = '/api'; // proxied to http://localhost:8080
  const MINI_API_URL = '/mini-api'; // proxied to http://localhost:8081

  const API_URL = selectedModel === 'main' ? MAIN_API_URL : MINI_API_URL;
  const API_KEY = import.meta.env.VITE_API_KEY || 'dev-secret-key';
  const BATCH_API_URL = selectedModel === 'main' ? undefined : MINI_API_URL;

  useEffect(() => {
    const fetchBrandMappings = async () => {
      setIsLoadingBrands(true);
      setBrandLoadError(null);
      try {
        const response = await fetch(`${API_URL}/keywords/brands`, {
          headers: {
            'X-API-Key': API_KEY
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch brand mappings');
        }

        const data = await response.json();
        const mappings: unknown = data?.brand_mappings;
        if (Array.isArray(mappings)) {
          const normalized: BrandMapping[] = (mappings as unknown[])
            .map((mapping) => {
              const candidate = mapping as Partial<BrandMapping>;
              const brandValue = typeof candidate.brand === 'string' ? candidate.brand.trim().toLowerCase() : '';
              const domainValue = typeof candidate.domain === 'string' ? candidate.domain.trim().toLowerCase() : '';
              return {
                brand: brandValue,
                domain: domainValue
              };
            })
            .filter((mapping): mapping is BrandMapping => Boolean(mapping.brand) && Boolean(mapping.domain));
          setBrandMappings(normalized);
        } else {
          setBrandMappings([] as BrandMapping[]);
        }
      } catch (brandError: any) {
        setBrandLoadError(brandError.message || 'Unable to load brand mappings');
      } finally {
        setIsLoadingBrands(false);
      }
    };

    fetchBrandMappings();
  }, []);

  const brandDomainMap = useMemo(() => {
    const map = new Map<string, string>();
    brandMappings.forEach(({ brand, domain }) => {
      map.set(brand, domain);
    });
    return map;
  }, [brandMappings]);

  const deriveBrandHints = (targetUrl: string): { brand?: string; legitimateDomain?: string } => {
    const trimmedSelectedBrand = selectedBrand.trim().toLowerCase();
    if (trimmedSelectedBrand && brandDomainMap.has(trimmedSelectedBrand)) {
      return {
        brand: trimmedSelectedBrand,
        legitimateDomain: brandDomainMap.get(trimmedSelectedBrand)
      };
    }

    let parsedUrl: URL | null = null;
    try {
      parsedUrl = targetUrl.startsWith('http') ? new URL(targetUrl) : new URL(`https://${targetUrl}`);
    } catch {
      return {};
    }

    const host = parsedUrl.hostname.toLowerCase();
    const hostNoDots = host.replace(/\./g, '');

    let bestMatch: { brand: string; domain: string; score: number } | null = null;

    brandMappings.forEach(({ brand, domain }) => {
      const candidateBrand = brand.toLowerCase();
      const candidateDomain = domain.toLowerCase();
      let score = 0;

      if (host === candidateDomain) {
        score = 100;
      } else if (host.endsWith(`.${candidateDomain}`) || host.endsWith(candidateDomain)) {
        score = Math.max(score, 90);
      } else if (candidateDomain.replace(/\./g, '').length > 0 && hostNoDots.includes(candidateDomain.replace(/\./g, ''))) {
        score = Math.max(score, 75);
      } else if (candidateBrand && host.includes(candidateBrand)) {
        score = Math.max(score, 60);
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { brand: candidateBrand, domain: candidateDomain, score };
      }
    });

    if (bestMatch) {
      const { brand, domain } = bestMatch;
      return {
        brand,
        legitimateDomain: domain
      };
    }

    return {};
  };

  const runAnalysis = async (
    targetUrl: string,
    hints: { brand?: string; legitimateDomain?: string }
  ) => {
    setIsLoading(true);
    setError(null);
    setAnalysisData(null);

    try {
      // Submit URL for scraping
      const payload: Record<string, string> = { 
        url: targetUrl,
        analysis_mode: analysisMode
      };
      if (hints.brand) {
        payload.brand = hints.brand;
      }
      if (hints.legitimateDomain) {
        payload.legitimate_domain = hints.legitimateDomain;
      }

      const scrapeResponse = await fetch(`${API_URL}/scrape`, {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!scrapeResponse.ok) {
        throw new Error('Failed to submit URL for analysis');
      }

      const scrapeData = await scrapeResponse.json();
      const jobId = scrapeData.job_ids[0];

      // Poll for job completion
      let attempts = 0;
      const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max

      const pollJob = async (): Promise<void> => {
        if (attempts >= maxAttempts) {
          throw new Error('Analysis timeout - job took too long');
        }

        const jobResponse = await fetch(`${API_URL}/job/${jobId}`, {
          headers: { 'X-API-Key': API_KEY }
        });

        if (!jobResponse.ok) {
          throw new Error('Failed to check job status');
        }

        const jobData = (await jobResponse.json()) as JobDetail;

        if (jobData.state === 'done') {
          // Job complete - features should be in job response
          // In production, features.json is at: ${jobData.root}/features.json
          const mlFeatures = jobData.ml_features || generateMockFeatures(targetUrl);
          const mlPrediction = jobData.ml_prediction || generateMockPrediction();

          setAnalysisData({
            domainDetails: jobData.domain_details || null,
            mlFeatures,
            mlPrediction
          });

        } else if (jobData.state === 'error') {
          throw new Error(jobData.error || 'Analysis failed');
        } else {
          // Still running, poll again
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
          await pollJob();
        }
      };

      await pollJob();

    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis');
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeURL = async (overrideUrl?: string) => {
    const inputUrl = (overrideUrl ?? url).trim();
    if (!inputUrl) {
      setError('Please enter a URL');
      return;
    }

    try {
      const statusResponse = await fetch(`${API_URL}/model/status`, {
        headers: { 'X-API-Key': API_KEY }
      });

      if (!statusResponse.ok) {
        throw new Error('Unable to verify ML model availability');
      }

      const statusData = await statusResponse.json();
      if (!statusData.model_available) {
        setError('ML model is unavailable. Please restore the model before running analysis.');
        return;
      }
    } catch (statusError: any) {
      setError(statusError.message || 'Unable to verify ML model availability');
      return;
    }

    const hints = deriveBrandHints(inputUrl);

    await runAnalysis(inputUrl, hints);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      analyzeURL();
    }
  };

  const handleBatchStartAnalysis = (batchId: string, urls: string[]) => {
    setActiveBatchId(batchId);
    setBatchUrls(urls);
    // Clear single URL analysis
    setAnalysisData(null);
    setUrl('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text mb-2">URL Analysis</h1>
        <p className="text-text-secondary">
          Analyze single URLs or upload an Excel file for batch processing
        </p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="py-6">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                placeholder="Enter URL to analyze (e.g., https://example.com)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
              />
            </div>
            <div className="min-w-[220px]">
              <label className="block text-sm font-medium text-text mb-1.5">
                Brand Context
              </label>
              <select
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-150 disabled:opacity-50"
                value={selectedBrand}
                onChange={(event) => setSelectedBrand(event.target.value)}
                disabled={isLoading || isLoadingBrands || brandMappings.length === 0}
              >
                <option value="">Auto-detect</option>
                {brandMappings.map(({ brand, domain }) => (
                  <option key={brand} value={brand}>
                    {brand} — {domain}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px]">
              <label className="block text-sm font-medium text-text mb-1.5">
                Model
              </label>
              <select
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-150 disabled:opacity-50"
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value as 'main' | 'mini')}
                disabled={isLoading}
              >
                <option value="main">Main model</option>
                <option value="mini">Mini model</option>
              </select>
            </div>
            <div className="min-w-[200px]">
              <label className="block text-sm font-medium text-text mb-1.5">
                Analysis Mode
              </label>
              <select
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-150 disabled:opacity-50"
                value={analysisMode}
                onChange={(event) => setAnalysisMode(event.target.value as 'url_only' | 'full_analysis')}
                disabled={isLoading}
              >
                <option value="url_only">Fast (URL only)</option>
                <option value="full_analysis">Full (with SSIM)</option>
              </select>
            </div>
            <Button 
              variant="primary" 
              onClick={() => analyzeURL()}
              disabled={isLoading || !url.trim()}
            >
              {isLoading ? (
                <>
                  <Loader size={16} className="mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search size={16} className="mr-2" />
                  Analyze
                </>
              )}
            </Button>
          </div>
          {brandLoadError && (
            <p className="mt-2 text-xs text-danger">{brandLoadError}</p>
          )}
          
          {error && (
            <div className="mt-3 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>


      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <Loader size={48} className="mx-auto mb-4 text-primary animate-spin" />
            <h3 className="text-lg font-semibold text-text mb-2">Analyzing URL...</h3>
            <p className="text-text-secondary">
              Scraping page, extracting features, and running ML prediction
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {analysisData && !isLoading && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text">Analysis Result</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!analysisData) return;
                const printWindow = window.open('', '_blank');
                if (!printWindow) return;

                const c = classifySecurityRisk({
                  ml_prediction: analysisData.mlPrediction,
                  ml_features: analysisData.mlFeatures,
                  url: url,
                  root: url,
                  id: '',
                  state: 'done',
                  feature_path: null,
                  error: null,
                  created_at: '',
                  updated_at: '',
                });

                const dd = analysisData.domainDetails;
                const feats = analysisData.mlFeatures;
                const pred = analysisData.mlPrediction;

                printWindow.document.write(`
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <title>URL Analysis Report - ${url}</title>
                    <style>
                      body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
                      h1 { color: #1a1a2e; border-bottom: 3px solid #0066cc; padding-bottom: 12px; margin-bottom: 8px; }
                      .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
                      .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
                      .meta-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
                      .meta-label { color: #64748b; font-size: 13px; }
                      .meta-value { font-weight: 600; font-size: 14px; }
                      .verdict { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 700; margin-bottom: 16px; }
                      .verdict-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
                      .verdict-warning { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
                      .verdict-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
                      .section { margin-bottom: 28px; }
                      .section-title { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
                      .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
                      .feature-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
                      .feature-name { color: #64748b; }
                      .feature-value { font-weight: 600; color: #334155; }
                      .footer { margin-top: 40px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: space-between; }
                    </style>
                  </head>
                  <body>
                    <h1>URL Analysis Report</h1>
                    <div class="subtitle">Analyzed: <strong>${url}</strong> &nbsp;|&nbsp; Date: <strong>${new Date().toLocaleString()}</strong></div>
                    <div class="meta-box">
                      <div class="meta-row">
                        <div>
                          <div class="meta-label">Verdict</div>
                          <span class="verdict ${c.badgeVariant === 'danger' ? 'verdict-danger' : c.badgeVariant === 'warning' ? 'verdict-warning' : 'verdict-success'}">${c.label}</span>
                        </div>
                        <div style="text-align:right">
                          <div class="meta-label">Confidence</div>
                          <div class="meta-value">${(c.confidence * 100).toFixed(1)}%</div>
                        </div>
                        <div style="text-align:right">
                          <div class="meta-label">Risk Score</div>
                          <div class="meta-value">${(c.riskScore * 100).toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                    ${dd ? `
                    <div class="section">
                      <div class="section-title">Domain Details</div>
                      <div class="feature-grid">
                        <div class="feature-row"><span class="feature-name">Registrar</span><span class="feature-value">${dd.registrar_name || 'N/A'}</span></div>
                        <div class="feature-row"><span class="feature-name">Registration Date</span><span class="feature-value">${dd.domain_registration_date || 'N/A'}</span></div>
                        <div class="feature-row"><span class="feature-name">Hosting Country</span><span class="feature-value">${dd.hosting_country || 'N/A'}</span></div>
                      </div>
                    </div>
                    ` : ''}
                    ${pred ? `
                    <div class="section">
                      <div class="section-title">ML Prediction</div>
                      <div class="feature-grid">
                        <div class="feature-row"><span class="feature-name">Prediction</span><span class="feature-value">${pred.prediction || 'N/A'}</span></div>
                        <div class="feature-row"><span class="feature-name">Confidence</span><span class="feature-value">${(pred.confidence * 100).toFixed(1)}%</span></div>
                        <div class="feature-row"><span class="feature-name">Risk Score</span><span class="feature-value">${(pred.risk_score * 100).toFixed(1)}%</span></div>
                      </div>
                    </div>
                    ` : ''}
                    ${feats ? `
                    <div class="section">
                      <div class="section-title">Feature Extraction</div>
                      <div class="feature-grid">
                        ${Object.entries(feats).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `
                          <div class="feature-row"><span class="feature-name">${k.replace(/_/g, ' ')}</span><span class="feature-value">${v}</span></div>
                        `).join('')}
                      </div>
                    </div>
                    ` : ''}
                    <div class="footer">
                      <span>URLShield Security Report</span>
                      <span>${new Date().toISOString().split('T')[0]}</span>
                    </div>
                    <script>window.onload = () => { setTimeout(() => window.print(), 500); };</script>
                  </body>
                  </html>
                `);
                printWindow.document.close();
              }}
              className="flex items-center gap-1.5"
            >
              <Download size={14} />
              Download PDF
            </Button>
          </div>
          <DomainDetailsCard details={analysisData.domainDetails} />
          <MLFeaturesDisplay 
            mlFeatures={analysisData.mlFeatures}
            mlPrediction={analysisData.mlPrediction}
          />
        </div>
      )}

      {/* Empty State */}
      {!analysisData && !isLoading && !error && !activeBatchId && (
        <Card>
          <CardContent className="text-center py-12">
            <Search size={48} className="mx-auto mb-4 text-text-secondary opacity-50" />
            <h3 className="text-lg font-semibold text-text mb-2">No Analysis Yet</h3>
            <p className="text-text-secondary">
              Enter a URL above to see complete ML feature extraction and prediction results
            </p>
          </CardContent>
        </Card>
      )}

      {/* Batch Upload Section */}
      {!isLoading && !analysisData && (
        <BatchUpload 
          onUploadComplete={(batchId, totalUrls) => console.log(`Uploaded ${totalUrls} URLs, batch ID: ${batchId}`)}
          onStartAnalysis={handleBatchStartAnalysis}
          apiBaseUrl={BATCH_API_URL}
        />
      )}

      {/* Batch Monitor */}
      {activeBatchId && (
        <BatchMonitor 
          batchId={activeBatchId} 
          urls={batchUrls}
          apiBaseUrl={BATCH_API_URL}
          onClose={() => { setActiveBatchId(null); setBatchUrls([]); }}
        />
      )}
    </div>
  );
};

// Mock data generators (remove these once backend is fully integrated)
const generateMockFeatures = (url: string) => {
  // Normalize URL - add https:// if missing
  const normalizedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : 'https://' + url;
  const domain = new URL(normalizedUrl).hostname;
  return {
    url_length: normalizedUrl.length,
    domain_length: domain.length,
    path_length: new URL(normalizedUrl).pathname.length,
    num_subdomains: domain.split('.').length - 2,
    num_dots: normalizedUrl.split('.').length - 1,
    domain_num_hyphens: domain.split('-').length - 1,
    num_special_chars: (url.match(/[@#?&=%]/g) || []).length,
    url_entropy: 3.5 + Math.random(),
    is_idn: 0,
    brand_word_present: domain.includes('paypal') || domain.includes('amazon') ? 1 : 0,
    misleading_keyword_present: domain.includes('login') || domain.includes('verify') ? 1 : 0,
    typosquatting_score: Math.random() > 0.7 ? 'High' : Math.random() > 0.4 ? 'Medium' : 'Low',
    brand_position: 'subdomain',
    domain_age_days: Math.floor(Math.random() * 3650),
    HTTPS: url.startsWith('https') ? 'Yes' : 'No',
    Is_Tunneling: 0,
    ttl_avg: 3600,
    asn_number: Math.floor(Math.random() * 100000),
    reverse_dns_entropy: 2.0 + Math.random(),
    ssim_score: Math.random(),
    favicon_similarity_score: Math.random(),
    domain: domain,
    url: url
  };
};

const generateMockPrediction = () => {
  const isPhishing = Math.random() > 0.5;
  const confidence = 0.7 + Math.random() * 0.3;
  
  return {
    prediction: isPhishing ? 'phishing' : 'legitimate',
    confidence: confidence,
    risk_score: isPhishing ? confidence : (1 - confidence),
    probabilities: {
      legitimate: isPhishing ? (1 - confidence) : confidence,
      phishing: isPhishing ? confidence : (1 - confidence)
    }
  };
};
