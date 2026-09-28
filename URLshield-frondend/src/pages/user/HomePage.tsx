import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Loader,
  Shield,
  Zap,
  CheckCircle2,
  CheckCircle,
  ArrowRight,
  Globe,
  Lock,
  AlertTriangle,
  Clock,
  Download,
  Sparkles,
  ArrowDown,
  X,
  SquareDot,
} from 'lucide-react';
import { MLFeaturesDisplay } from '../../components/MLFeaturesDisplay';
import { DomainDetailsCard } from '../../components/DomainDetailsCard';
import { BatchUpload } from '../../components/BatchUpload';
import { BatchMonitor } from '../../components/BatchMonitor';
import { Button } from '../../components/Button';
import { CyberUrlGlobe } from '../../components/CyberUrlGlobe';
import { CustomSelect } from '../../components/CustomSelect';
import { classifySecurityRisk } from '../../lib/classification';
import { apiClient } from '../../lib/api';
import type { DomainDetails, MLFeatures, MLPrediction, JobDetail } from '../../types/api';

type BrandMapping = { brand: string; domain: string };

interface AnalysisResult {
  domainDetails: DomainDetails | null;
  mlFeatures: MLFeatures;
  mlPrediction: MLPrediction;
}

interface RecentScan {
  domain: string;
  url: string;
  scan_time: string;
  prediction?: string;
  confidence?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const MAIN_API_URL = '/api';
const MINI_API_URL = '/mini-api';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-secret-key';

const LOADING_PHRASES = [
  "Initializing AI engine...",
  "Scraping DOM & network requests...",
  "Extracting URL topology features...",
  "Analyzing SSL certificates...",
  "Scanning for typosquatting...",
  "Evaluating machine learning model...",
  "Finalizing security classification..."
];

export const HomePage: React.FC = () => {
  // ─── State ──────────────────────────────────────────────────────────────────
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchUrls, setBatchUrls] = useState<string[]>([]);
  const [brandMappings, setBrandMappings] = useState<BrandMapping[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'main' | 'mini'>('main');
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);

  const BATCH_API_URL = selectedModel === 'main' ? undefined : MINI_API_URL;

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingSectionRef = useRef<HTMLDivElement>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);


  // ─── Fetch brand mappings ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchBrandMappings = async () => {
      setIsLoadingBrands(true);
      try {
        const brandUrl = selectedModel === 'main' ? 'http://localhost:8080' : 'http://localhost:8081';
        const response = await fetch(`${brandUrl}/keywords/brands`, {
          headers: { 'X-API-Key': API_KEY },
        });
        if (!response.ok) throw new Error('Failed to fetch brand mappings');
        const data = await response.json();
        const mappings: unknown = data?.brand_mappings;
        if (Array.isArray(mappings)) {
          const normalized: BrandMapping[] = (mappings as unknown[])
            .map((m) => {
              const c = m as Partial<BrandMapping>;
              return {
                brand: typeof c.brand === 'string' ? c.brand.trim().toLowerCase() : '',
                domain: typeof c.domain === 'string' ? c.domain.trim().toLowerCase() : '',
              };
            })
            .filter((m): m is BrandMapping => Boolean(m.brand) && Boolean(m.domain));
          setBrandMappings(normalized);
        }
      } catch {
        /* silent – optional enhancement */
      } finally {
        setIsLoadingBrands(false);
      }
    };
    fetchBrandMappings();
  }, []);

  // ─── Fetch recent scans ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchRecent = async () => {
      setRecentLoading(true);
      try {
        const scanUrl = selectedModel === 'main' ? 'http://localhost:8080' : 'http://localhost:8081';
        const res = await fetch(`${scanUrl}/scan-history?limit=5`, {
          headers: { 'X-API-Key': API_KEY },
        });
        if (res.ok) {
          const data = await res.json();
          const items = (data.items || []).slice(0, 5).map((item: any) => ({
            domain: item.domain || '',
            url: item.url || '',
            scan_time: item.scan_time || '',
            prediction: item.ml_prediction?.prediction,
            confidence: item.ml_prediction?.confidence,
          }));
          setRecentScans(items);
        }
      } catch {
        /* silent */
      } finally {
        setRecentLoading(false);
      }
    };
    fetchRecent();
  }, [analysisData]); // re-fetch after a new analysis

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
      }, 2500);
    } else {
      setLoadingPhraseIndex(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // ─── Scroll to analysis/results ──────────────────────────────────────────
  useEffect(() => {
    if (isLoading) {
      // Small timeout to ensure the section is rendered before scrolling
      const timer = setTimeout(() => {
        loadingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  useEffect(() => {
    if (analysisData && !isLoading) {
      const timer = setTimeout(() => {
        resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [analysisData, isLoading]);

  // ─── Brand detection helpers ──────────────────────────────────────────────
  const brandDomainMap = useMemo(() => {
    const map = new Map<string, string>();
    brandMappings.forEach((mapping) => map.set(mapping.brand, mapping.domain));
    return map;
  }, [brandMappings]);

  const deriveBrandHints = (targetUrl: string): { brand?: string; legitimateDomain?: string } => {
    const trimmed = selectedBrand.trim().toLowerCase();
    if (trimmed && brandDomainMap.has(trimmed)) {
      return { brand: trimmed, legitimateDomain: brandDomainMap.get(trimmed) };
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
    brandMappings.forEach((mapping) => {
      let score = 0;
      if (host === mapping.domain) score = 100;
      else if (host.endsWith(`.${mapping.domain}`)) score = 90;
      else if (hostNoDots.includes(mapping.domain.replace(/\./g, ''))) score = 75;
      else if (mapping.brand && host.includes(mapping.brand)) score = 60;
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { brand: mapping.brand, domain: mapping.domain, score };
      }
    });
    if (bestMatch !== null) {
      const result = bestMatch as { brand: string; domain: string; score: number };
      return { brand: result.brand, legitimateDomain: result.domain };
    }
    return {};
  };

  // ─── Analysis logic (preserved from URLAnalysis.tsx) ──────────────────────
  const handleStopAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const runAnalysis = async (inputUrl: string, hints: { brand?: string; legitimateDomain?: string }) => {
    setIsLoading(true);
    setError(null);
    setAnalysisData(null);

    // We assume abortControllerRef is already initialized by analyzeURL
    const signal = abortControllerRef.current?.signal;

    try {
      const payload: Record<string, string> = { url: inputUrl };
      if (hints.brand) payload.brand = hints.brand;
      if (hints.legitimateDomain) payload.legitimate_domain = hints.legitimateDomain;

      const targetUrl = selectedModel === 'main' ? 'http://localhost:8080' : 'http://localhost:8081';
      const scrapeRes = await fetch(`${targetUrl}/scrape`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
      if (!scrapeRes.ok) throw new Error('Failed to submit URL for analysis');
      const scrapeData = await scrapeRes.json();
      const jobId = scrapeData.job_ids[0];

      let attempts = 0;
      const maxAttempts = 60;
      const pollJob = async (): Promise<void> => {
        if (signal?.aborted) throw new Error('AbortError');
        if (attempts >= maxAttempts) throw new Error('Analysis timeout');
        const jobRes = await fetch(`${targetUrl}/job/${jobId}`, { headers: { 'X-API-Key': API_KEY }, signal });
        if (!jobRes.ok) throw new Error('Failed to check job status');
        const jobData = (await jobRes.json()) as JobDetail;
        if (jobData.state === 'done') {
          const features = jobData.ml_features;
          const prediction = jobData.ml_prediction;
          if (features && prediction) {
            setAnalysisData({
              domainDetails: jobData.domain_details || null,
              mlFeatures: features,
              mlPrediction: prediction,
            });
          } else {
            throw new Error('Analysis completed but missing ML data');
          }
        } else if (jobData.state === 'error') {
          throw new Error(jobData.error || 'Analysis failed');
        } else {
          attempts++;
          await new Promise((r) => setTimeout(r, 2000));
          if (signal?.aborted) throw new Error('AbortError');
          await pollJob();
        }
      };
      await pollJob();
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'AbortError') {
        setError('Analysis stopped by user.');
      } else {
        setError(err.message || 'An error occurred during analysis');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeURL = async () => {
    const input = url.trim();
    if (!input) { setError('Please enter a URL'); return; }

    setIsLoading(true);
    setError(null);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // Configure apiClient for the selected model
      const targetUrl = selectedModel === 'main' ? 'http://localhost:8080' : 'http://localhost:8081';
      apiClient.configure(targetUrl, API_KEY);

      // Check model status using a direct fetch since apiClient doesn't have this endpoint
      const statusUrl = selectedModel === 'main' ? 'http://localhost:8080/model/status' : 'http://localhost:8081/model/status';
      const statusRes = await fetch(statusUrl, { headers: { 'X-API-Key': API_KEY }, signal });
      if (!statusRes.ok) throw new Error('Unable to verify ML model');
      const statusData = await statusRes.json();
      if (!statusData.model_available) {
        setError('ML model is unavailable. Please restore the model first.');
        setIsLoading(false);
        return;
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || e.message === 'AbortError') {
        setError('Analysis stopped by user.');
      } else {
        setError(e.message || 'Unable to verify ML model');
      }
      setIsLoading(false);
      return;
    }
    await runAnalysis(input, deriveBrandHints(input));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) analyzeURL();
  };

  const handleClear = () => {
    setUrl('');
    setAnalysisData(null);
    setError(null);
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const truncateUrl = (url: string, maxLength: number = 40) => {
    if (url.length <= maxLength) return url;
    return url.slice(0, maxLength - 3) + '...';
  };

  const verdictBadge = (prediction?: string) => {
    if (!prediction) return null;
    const p = prediction.toLowerCase();
    if (p === 'phishing')
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100"><AlertTriangle size={11} /> Phishing</span>;
    if (p === 'suspected')
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100"><AlertTriangle size={11} /> Suspected</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100"><CheckCircle2 size={11} /> Legitimate</span>;
  };

  const getClassificationBadge = (analysisData: AnalysisResult | null) => {
    if (!analysisData || !analysisData.mlPrediction) return null;
    // Build a partial JobDetail-like object for classification
    const classification = classifySecurityRisk({
      ml_prediction: analysisData.mlPrediction,
      ml_features: analysisData.mlFeatures,
      url: '',
      root: '',
      id: '',
      state: 'done',
      feature_path: null,
      error: null,
      created_at: '',
      updated_at: '',
    });
    const icon = classification.category === 'phishing'
      ? <AlertTriangle size={11} />
      : classification.category === 'suspected'
        ? <AlertTriangle size={11} />
        : <CheckCircle2 size={11} />;
    const bg = classification.badgeVariant === 'danger'
      ? 'bg-red-50 text-red-600 border-red-100'
      : classification.badgeVariant === 'warning'
        ? 'bg-amber-50 text-amber-600 border-amber-100'
        : 'bg-emerald-50 text-emerald-600 border-emerald-100';
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${bg}`}>
        {icon} {classification.label}
      </span>
    );
  };

  const handleDownloadPDF = () => {
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

    const htmlContent = `
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
          <div class="meta-row" style="margin-top:12px">
            <div style="flex:1">
              <div class="meta-label">Explanation</div>
              <div style="font-size:13px;color:#475569;margin-top:4px">${c.explanation}</div>
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
            <div class="feature-row"><span class="feature-name">Registrant</span><span class="feature-value">${dd.registrant_name || 'N/A'}</span></div>
            <div class="feature-row"><span class="feature-name">ISP</span><span class="feature-value">${dd.hosting_isp || 'N/A'}</span></div>
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

        <script>
          window.onload = () => { setTimeout(() => window.print(), 500); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative">
      {/* ═══ GLOBAL BACKGROUND ANIMATION ═══ */}
      <CyberUrlGlobe />

      {/* ═══ HERO SECTION ═══ */}
      <section id="url-analysis" className="relative z-10">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5"></div>
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl opacity-20"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-12">
          {/* Hero Content */}
          <div className="max-w-4xl mx-auto mb-8 animate-fade-in-up relative z-10">

            {/* Hero Text */}
            <div className="text-center">
              {/* Project Branding */}
              <div className="flex items-center justify-center gap-6 mb-6">
                <div className="relative">
                  <Shield
                    size={64}
                    className="text-primary"
                    strokeWidth={2.5}
                    fill="currentColor"
                    fillOpacity={0.1}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-bold text-primary text-lg">C</span>
                  </div>
                </div>
                <span className="text-5xl font-bold text-text">
                  URLShield
                </span>
              </div>

              {/* Floating Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-blue-500/10 border border-primary/20 text-primary text-xs font-medium mb-8 shadow-lg backdrop-blur-sm animate-pulse">
                <Shield size={14} className="animate-bounce" />
                AI-Powered Phishing Detection
                <Sparkles size={14} className="animate-spin" />
              </div>

              {/* Main Heading */}
              <h1 className="text-3xl sm:text-4xl lg:text-6xl font-extrabold text-text leading-relaxed mb-6 tracking-tight" style={{ lineHeight: '1.3', paddingBottom: '0.2em' }}>
                Protect yourself from
                <span className="gradient-text block mt-2" style={{ lineHeight: '1.3', paddingBottom: '0.2em', display: 'inline-block' }}>phishing threats</span>
              </h1>

              {/* Description */}
              <p className="text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto mb-8">
                Paste any suspicious URL below. Our AI analyzes domain features,
                SSL certificates, content patterns and more to determine if a site
                is safe.
              </p>

              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-text-secondary">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-success" />
                  <span>99.9% Accuracy</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-primary" />
                  <span>Instant Analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-warning" />
                  <span>Real-time Protection</span>
                </div>
              </div>

              {/* Scroll to Analyze Button */}
              <div className="mt-10 flex justify-center animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <button
                  onClick={() => {
                    const input = document.getElementById('url-input-field');
                    if (input) {
                      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      setTimeout(() => input.focus(), 500);
                    }
                  }}
                  className="inline-flex items-center gap-4 px-6 py-3 rounded-full bg-surface/40 backdrop-blur-md border border-white/10 text-primary font-medium hover:bg-primary/10 hover:border-primary/30 transition-all duration-500 group shadow-[0_0_20px_rgba(59,130,246,0.1)] hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] hover:-translate-y-1"
                >
                  <span className="text-sm tracking-wide">Start Analyzing</span>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors duration-500 border border-primary/20">
                    <ArrowDown size={14} className="group-hover:animate-bounce" />
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* ─── URL Checker Card ─── */}
          <div className="max-w-4xl mx-auto px-4 relative z-20">
            <div className="bg-surface/60 backdrop-blur-[24px] rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 p-10 sm:p-14 relative overflow-hidden group/card hover:bg-surface/70 transition-all duration-700 hover:shadow-primary/10 hover:border-primary/20">
              {/* Premium Animated Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-1000 animate-gradient-move bg-[length:200%_200%]"></div>
              
              {/* Isolated Background Effects Layer (Clipped) */}
              <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none z-0">
                {/* Full Box Faint Pink Hover Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-700"></div>

                {/* Card Background Effects */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] group-hover/card:bg-primary/20 transition-all duration-1000"></div>
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] group-hover/card:bg-blue-500/20 transition-all duration-1000"></div>
              </div>

              {/* URL Input Row */}
              <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                <div className="flex-1 relative group/inputbox">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary z-20">
                    <Globe size={18} />
                  </div>
                  <input
                    id="url-input-field"
                    type="text"
                    placeholder="Paste URL to analyze..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={handleKeyPress}
                    disabled={isLoading}
                    className="relative w-full pl-12 pr-10 py-4 rounded-2xl bg-surface/40 backdrop-blur-xl border border-border/50 text-text text-base placeholder:text-text-secondary/50 placeholder:font-light focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-surface/80 transition-all duration-500 disabled:opacity-90 disabled:bg-surface/40 disabled:cursor-not-allowed shadow-inner hover:bg-surface/60 hover:shadow-lg hover:border-border"
                  />
                  {url && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-20">
                      {isLoading ? (
                        <button
                          type="button"
                          onClick={handleStopAnalysis}
                          className="flex items-center justify-center w-9 h-9 rounded-full bg-surface-secondary/80 hover:bg-surface-secondary transition-all duration-300 group/stop shadow-sm border border-white/5"
                          title="Terminate Analysis"
                        >
                          <div className="w-2.5 h-2.5 bg-text rounded-[2px]"></div>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleClear}
                          className="p-2 text-text-secondary/60 hover:text-text-secondary transition-colors"
                          title="Clear URL"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={analyzeURL}
                  disabled={isLoading || !url.trim()}
                  className={`relative flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-primary via-blue-600 to-primary bg-[length:200%_auto] animate-gradient-move text-white text-lg font-bold focus:ring-4 focus:ring-primary/30 disabled:opacity-80 disabled:cursor-not-allowed transition-all duration-500 shadow-[0_10px_20px_-5px_rgba(59,130,246,0.5)] hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.6)] transform hover:-translate-y-1 active:scale-95 overflow-hidden group/btn`}
                >
                  {isLoading ? (
                    <>
                      <Loader size={20} className="animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search size={20} className="group-hover/btn:scale-110 transition-transform" />
                      Analyze URL
                      <ArrowRight size={18} className="group-hover/btn:translate-x-1.5 transition-transform" />
                    </>
                  )}
                  {/* Premium Shimmer Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite] transition-transform"></div>
                </button>
              </div>

              {/* Options Row */}
              <div className="flex flex-col sm:flex-row gap-4 mt-6 relative z-30">
                <div className="flex-1 group/select">
                  <label className="block text-xs font-medium text-text-secondary mb-1.5 transition-colors group-hover/select:text-primary/70">Brand Context</label>
                  <CustomSelect
                    options={[
                      { value: '', label: 'Auto-detect' },
                      ...brandMappings.map(({ brand, domain }) => ({ value: brand, label: `${brand} — ${domain}` }))
                    ]}
                    value={selectedBrand}
                    onChange={setSelectedBrand}
                    disabled={isLoading || isLoadingBrands || brandMappings.length === 0}
                    placeholder="Auto-detect"
                  />
                </div>
                <div className="sm:w-56 group/select">
                  <label className="block text-xs font-medium text-text-secondary mb-1.5 transition-colors group-hover/select:text-primary/70">Model</label>
                  <CustomSelect
                    options={[
                      { value: 'main', label: 'Main model' },
                      { value: 'mini', label: 'Mini model' }
                    ]}
                    value={selectedModel}
                    onChange={(val) => setSelectedModel(val as 'main' | 'mini')}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
                  <AlertTriangle size={15} />
                  {error}
                </div>
              )}

              {/* ─── Seamless Batch Upload Integration ─── */}
              {!isLoading && !analysisData && !activeBatchId && (
                <div className="mt-12 relative">
                  {/* Subtle OR Divider */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 w-full px-10 opacity-30">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-text"></div>
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-text-secondary">OR</span>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-text"></div>
                  </div>

                  <div className="pt-8 group/batch">
                    <BatchUpload
                      onUploadComplete={(batchId: string, totalUrls: number) => {
                        console.log(`Uploaded ${totalUrls} URLs, batch ID: ${batchId}`);
                      }}
                      onStartAnalysis={(batchId: string, urls: string[]) => {
                        setActiveBatchId(batchId);
                        setBatchUrls(urls);
                        setAnalysisData(null);
                        setUrl('');
                      }}
                      apiBaseUrl={BATCH_API_URL}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ LOADING STATE ═══ */}
      {isLoading && (
        <section ref={loadingSectionRef} className="max-w-3xl mx-auto px-4 py-10 relative z-20">
          <div className="bg-surface/60 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/5 p-12 text-center animate-fade-in-up relative overflow-hidden group">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl z-0 pointer-events-none"></div>

            {/* Pulsing Sonar Rings */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full z-0 pointer-events-none overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-primary/20 rounded-full animate-pulse-ring"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-primary/10 rounded-full animate-pulse-ring" style={{ animationDelay: '1s' }}></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border border-primary/5 rounded-full animate-pulse-ring" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center">
              <div className="w-20 h-20 mb-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.15)] relative">
                <Loader size={40} className="text-primary animate-spin" />
                <div className="absolute inset-0 rounded-full border border-primary/30 border-t-transparent animate-spin" style={{ animationDuration: '3s' }}></div>
              </div>
              <h3 className="text-2xl font-bold text-text mb-3 tracking-tight">Analyzing URL…</h3>
              <div className="h-6 overflow-hidden flex items-center justify-center">
                <p
                  key={loadingPhraseIndex}
                  className="text-primary/90 font-medium animate-fade-in-up"
                  style={{ animationDuration: '400ms' }}
                >
                  {LOADING_PHRASES[loadingPhraseIndex]}
                </p>
              </div>
              {/* Animated Progress Line */}
              <div className="w-64 h-1 bg-surface-secondary rounded-full mt-8 overflow-hidden relative">
                <div className="absolute top-0 bottom-0 left-0 bg-primary w-1/3 rounded-full animate-progress-indeterminate"></div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ RESULTS ═══ */}
      {analysisData && !isLoading && (
        <section ref={resultsSectionRef} className="max-w-5xl mx-auto px-4 py-10 space-y-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-text">Analysis Result</h2>
            <div className="flex items-center gap-3">
              {getClassificationBadge(analysisData)}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5"
              >
                <Download size={14} />
                Download PDF
              </Button>
            </div>
          </div>
          <DomainDetailsCard details={analysisData.domainDetails} />
          <MLFeaturesDisplay mlFeatures={analysisData.mlFeatures} mlPrediction={analysisData.mlPrediction} />
        </section>
      )}


      {activeBatchId && (
        <section className="max-w-3xl mx-auto px-4 pb-10">
          <BatchMonitor batchId={activeBatchId} urls={batchUrls} apiBaseUrl={BATCH_API_URL} onClose={() => { setActiveBatchId(null); setBatchUrls([]); }} />
        </section>
      )}

      {/* ═══ HOW IT WORKS ═══ */}
      {!analysisData && !isLoading && !activeBatchId && (
        <section className="relative z-10 py-20 bg-transparent backdrop-blur-[2px]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-text mb-3">How It Works</h2>
              <p className="text-text-secondary max-w-md mx-auto">Three simple steps to verify any suspicious URL</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                {
                  icon: <Globe size={28} className="text-blue-500" />,
                  title: 'Paste URL',
                  desc: 'Enter any suspicious link into the analyzer above. We accept any URL format.',
                  step: '01',
                },
                {
                  icon: <Zap size={28} className="text-blue-500" />,
                  title: 'AI Analysis',
                  desc: 'Our XGBoost model examines 30+ domain, SSL, DNS, and visual similarity features.',
                  step: '02',
                },
                {
                  icon: <CheckCircle2 size={28} className="text-blue-500" />,
                  title: 'Get Results',
                  desc: 'Receive an instant verdict with confidence score and detailed feature breakdown.',
                  step: '03',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="relative bg-surface rounded-2xl p-8 text-center border border-border hover:shadow-premium-lg hover:-translate-y-1 transition-all duration-300 group"
                >
                  <span className="absolute top-4 right-5 text-5xl font-black text-border group-hover:text-primary/10 transition-colors select-none">
                    {item.step}
                  </span>
                  <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-text mb-2">{item.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ RECENTLY CHECKED ═══ */}
      <section className="relative z-10 py-16 bg-transparent backdrop-blur-[2px]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-text">Recently Checked</h2>
                <p className="text-sm text-text-secondary mt-1">Latest URL analysis results</p>
              </div>
              {recentScans.length > 3 && !recentLoading && (
                <button
                  onClick={() => setShowAllRecent(!showAllRecent)}
                  className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {showAllRecent ? (
                    <>View Less <ArrowRight size={14} className="rotate-90 transition-transform duration-300" /></>
                  ) : (
                    <>View All <ArrowRight size={14} className="transition-transform duration-300" /></>
                  )}
                </button>
              )}
            </div>

            {(() => {
              const isHistoryEmpty = recentScans.length === 0;

              if (recentLoading) {
                return (
                  <div className="flex items-center justify-center py-12">
                    <Loader size={24} className="animate-spin text-primary" />
                  </div>
                );
              }

              if (!isHistoryEmpty) {
                return (
                  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-500 ease-in-out ${showAllRecent ? '' : 'max-h-[280px] overflow-hidden'}`}>
                    {(showAllRecent ? recentScans : recentScans.slice(0, 3)).map((scan, idx) => (
                      <div
                        key={idx}
                        className="bg-surface rounded-2xl border border-border/50 p-6 hover:shadow-premium hover:-translate-y-1 transition-all duration-300 group/scan-item"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-surface/50 flex items-center justify-center flex-shrink-0 border border-border/30 group-hover/scan-item:border-primary/30 transition-colors">
                              <Lock size={16} className="text-text-secondary group-hover/scan-item:text-primary transition-colors" />
                            </div>
                            <span className="text-sm font-bold text-text truncate" title={scan.domain}>{truncateUrl(scan.domain, 28)}</span>
                          </div>
                          {verdictBadge(scan.prediction)}
                        </div>
                        <p className="text-xs text-text-secondary truncate mb-4 font-mono opacity-60" title={scan.url}>{truncateUrl(scan.url, 45)}</p>
                        <div className="flex items-center gap-2 text-xs text-text-secondary/80">
                          <Clock size={12} />
                          {scan.scan_time ? new Date(scan.scan_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                        </div>
                      </div>
                      ))}
                    </div>
                  );
                }

                // Return Empty State Placeholder
                return (
                  <div className="w-full bg-surface/40 backdrop-blur-3xl rounded-[2.5rem] border border-dashed border-primary/20 p-16 text-center animate-fade-in group relative overflow-hidden">
                    <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors duration-700"></div>
                    <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors duration-700"></div>

                    <div className="relative z-10">
                      <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-blue-500/10 border border-primary/20 flex items-center justify-center mx-auto mb-8 transition-all duration-700 group-hover:rotate-6 group-hover:scale-110 group-hover:border-primary/40 shadow-2xl">
                        <Search size={40} className="text-primary group-hover:animate-pulse" />
                        <div className="absolute inset-0 bg-primary/5 rounded-3xl animate-ping opacity-20"></div>
                      </div>
                      <h3 className="text-2xl font-bold text-text mb-4 tracking-tight">No recently searches yet</h3>
                      <p className="text-lg text-text-secondary max-w-md mx-auto leading-relaxed mb-10">
                        Search the first analysis to get started! Paste any URL above to see our AI in action.
                      </p>
                      <button 
                        onClick={() => {
                          const input = document.getElementById('url-input-field');
                          if (input) {
                            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => input.focus(), 500);
                          }
                        }}
                        className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-white text-base font-bold hover:bg-primary-hover hover:scale-105 hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all duration-500 group/btn"
                      >
                        <span>Start Your First Analysis</span>
                        <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>
      </div>
    );
};
