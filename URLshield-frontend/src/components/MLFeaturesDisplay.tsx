import React from 'react';
import { CardHeader, CardContent } from './Card';
import { 
  Link, Shield, AlertTriangle, 
  Globe, Image, Tag, CheckCircle, XCircle 
} from 'lucide-react';
import type { MLFeatures, MLPrediction } from '../types/api';

interface Props {
  mlFeatures?: MLFeatures;
  mlPrediction?: MLPrediction;
}

const PremiumCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-surface/60 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/5 relative overflow-hidden transition-all duration-700 hover:shadow-[0_0_60px_-15px_rgba(59,130,246,0.2)] hover:-translate-y-1 hover:border-white/10 group/resultcard ${className}`}>
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 group-hover/resultcard:opacity-100 transition-opacity duration-700 z-0"></div>
    <div className="relative z-10">
      {children}
    </div>
  </div>
);

export const MLFeaturesDisplay: React.FC<Props> = ({ mlFeatures, mlPrediction }) => {
  if (!mlFeatures) {
    return (
      <PremiumCard>
        <CardContent className="text-center py-8 text-text-secondary">
          <Tag size={48} className="mx-auto mb-2 opacity-50" />
          <p>No ML features available</p>
          <p className="text-sm">Features will appear after URL analysis</p>
        </CardContent>
      </PremiumCard>
    );
  }

  const getRiskColor = (score: number) => {
    if (score > 0.7) return 'text-danger';
    if (score > 0.4) return 'text-warning';
    return 'text-success';
  };

  const getPredictionColor = (prediction: string) => {
    const pred = prediction.toLowerCase();
    if (pred === 'phishing') return 'bg-danger/10 text-danger border-danger/20';
    if (pred === 'suspected') return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-success/10 text-success border-success/20';
  };

  return (
    <div className="space-y-6">
      {/* ML Prediction Summary */}
      {mlPrediction && (
        <PremiumCard className={`border ${getPredictionColor(mlPrediction.prediction)} shadow-lg`}>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {mlPrediction.prediction.toLowerCase() === 'phishing' ? (
                  <div className="p-3 bg-danger/10 rounded-full animate-pulse"><XCircle size={36} className="text-danger" /></div>
                ) : mlPrediction.prediction.toLowerCase() === 'suspected' ? (
                  <div className="p-3 bg-warning/10 rounded-full animate-pulse"><AlertTriangle size={36} className="text-warning" /></div>
                ) : (
                  <div className="p-3 bg-success/10 rounded-full animate-pulse"><CheckCircle size={36} className="text-success" /></div>
                )}
                <div>
                  <h3 className="text-2xl font-bold capitalize tracking-tight">{mlPrediction.prediction}</h3>
                  <p className="text-sm opacity-75 font-medium mt-1">
                    Confidence: {(mlPrediction.confidence * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-75 font-medium mb-1">Risk Score</p>
                <p className={`text-4xl font-extrabold ${getRiskColor(mlPrediction.risk_score)} drop-shadow-md`}>
                  {(mlPrediction.risk_score * 100).toFixed(0)}
                </p>
              </div>
            </div>
            
            {/* Probability Breakdown */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {/* Legitimate */}
              {(() => {
                const legitProb = mlPrediction.probabilities['Legitimate'] ?? 
                                 mlPrediction.probabilities['legitimate'] ?? 0;
                return (
                  <div className="bg-surface/50 backdrop-blur-sm border border-white/5 rounded-2xl p-4 shadow-inner hover:bg-surface/80 transition-colors">
                    <p className="text-xs text-text-secondary font-medium mb-2 uppercase tracking-wider">Legitimate</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-border/50 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-success h-2.5 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_currentColor]"
                          style={{ width: `${legitProb * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold">
                        {(legitProb * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })()}
              
              {/* Suspected */}
              {(() => {
                const suspectedProb = mlPrediction.probabilities['Suspected'] ?? 
                                     mlPrediction.probabilities['suspected'] ?? 0;
                return (
                  <div className="bg-surface/50 backdrop-blur-sm border border-white/5 rounded-2xl p-4 shadow-inner hover:bg-surface/80 transition-colors">
                    <p className="text-xs text-text-secondary font-medium mb-2 uppercase tracking-wider">Suspected</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-border/50 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-warning h-2.5 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_currentColor]"
                          style={{ width: `${suspectedProb * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold">
                        {(suspectedProb * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })()}
              
              {/* Phishing */}
              {(() => {
                const phishingProb = mlPrediction.probabilities['Phishing'] ?? 
                                    mlPrediction.probabilities['phishing'] ?? 0;
                return (
                  <div className="bg-surface/50 backdrop-blur-sm border border-white/5 rounded-2xl p-4 shadow-inner hover:bg-surface/80 transition-colors">
                    <p className="text-xs text-text-secondary font-medium mb-2 uppercase tracking-wider">Phishing</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-border/50 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-danger h-2.5 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_currentColor]"
                          style={{ width: `${phishingProb * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold">
                        {(phishingProb * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </PremiumCard>
      )}

      {/* ML Reasoning */}
      {mlPrediction?.reasoning && mlPrediction.reasoning.length > 0 && (
        <PremiumCard>
          <CardHeader className="border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <AlertTriangle size={20} className="text-primary" />
              </div>
              <h3 className="text-lg font-bold text-text tracking-wide">Why This Classification?</h3>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {mlPrediction.reasoning.map((reason, index) => (
                <li key={index} className="flex items-start gap-3 text-sm text-text-secondary bg-surface/30 p-3 rounded-xl border border-white/5">
                  <span className="text-primary mt-0.5">•</span>
                  <span className="leading-relaxed">{reason}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </PremiumCard>
      )}

      {/* Top Contributing Features */}
      {mlPrediction?.top_features && mlPrediction.top_features.length > 0 && (
        <PremiumCard>
          <CardHeader className="border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Tag size={20} className="text-primary" />
              </div>
              <h3 className="text-lg font-bold text-text tracking-wide">Top Contributing Features</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mlPrediction.top_features.map((feature, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:bg-surface/40 px-3 -mx-3 rounded-lg transition-colors">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-text">{feature.feature}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{feature.value}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-border/50 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                        style={{ width: `${feature.importance * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-text-secondary w-12 text-right">
                      {(feature.importance * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </PremiumCard>
      )}

      {/* Feature Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* URL Structure Features */}
        <PremiumCard>
          <CardHeader className="border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Link size={20} className="text-primary" />
              </div>
              <h3 className="text-lg font-bold text-text tracking-wide">URL Structure</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <FeatureRow label="URL Length" value={mlFeatures.url_length} unit="chars" />
            <FeatureRow label="Domain Length" value={mlFeatures.domain_length} unit="chars" />
            <FeatureRow label="Path Length" value={mlFeatures.path_length} unit="chars" />
            <FeatureRow label="Subdomains" value={mlFeatures.num_subdomains} />
            <FeatureRow label="Dots" value={mlFeatures.num_dots} />
            <FeatureRow label="Hyphens" value={mlFeatures.domain_num_hyphens} />
            <FeatureRow label="Special Characters" value={mlFeatures.num_special_chars} />
            <FeatureRow label="URL Entropy" value={mlFeatures.url_entropy?.toFixed(4) ?? 'N/A'} />
          </CardContent>
        </PremiumCard>

        {/* Detection Features */}
        <PremiumCard>
          <CardHeader className="border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <AlertTriangle size={20} className="text-warning" />
              </div>
              <h3 className="text-lg font-bold text-text tracking-wide">Detection Signals</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <FeatureRow 
              label="IDN Domain" 
              value={mlFeatures.is_idn === 1 ? 'Yes' : 'No'}
              highlight={mlFeatures.is_idn === 1}
            />
            <FeatureRow 
              label="Brand Word Present" 
              value={mlFeatures.brand_word_present === 1 ? 'Yes' : 'No'}
              highlight={mlFeatures.brand_word_present === 1}
            />
            <FeatureRow 
              label="Misleading Keywords" 
              value={mlFeatures.misleading_keyword_present === 1 ? 'Yes' : 'No'}
              highlight={mlFeatures.misleading_keyword_present === 1}
            />
            <FeatureRow 
              label="Typosquatting Score" 
              value={typeof mlFeatures.typosquatting_score === 'number' 
                ? mlFeatures.typosquatting_score.toFixed(2) 
                : mlFeatures.typosquatting_score ?? 'N/A'}
              highlight={typeof mlFeatures.typosquatting_score === 'number'
                ? mlFeatures.typosquatting_score > 0.5
                : (() => {
                    const numeric = parseFloat(String(mlFeatures.typosquatting_score ?? '0'));
                    return !Number.isNaN(numeric) && numeric > 0.5;
                  })()}
            />
            <FeatureRow 
              label="Brand Position" 
              value={mlFeatures.brand_position}
            />
          </CardContent>
        </PremiumCard>

        {/* Network & Security */}
        <PremiumCard>
          <CardHeader className="border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <Shield size={20} className="text-success" />
              </div>
              <h3 className="text-lg font-bold text-text tracking-wide">Network & Security</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <FeatureRow label="Domain Age" value={mlFeatures.domain_age_days} unit="days" />
            <FeatureRow 
              label="HTTPS" 
              value={mlFeatures.HTTPS}
              highlight={mlFeatures.HTTPS === 'No'}
            />
            <FeatureRow 
              label="Tunneling Detected" 
              value={String(mlFeatures.Is_Tunneling ?? 'N/A')}
              highlight={String(mlFeatures.Is_Tunneling ?? '').toLowerCase() === 'y'}
            />
            <FeatureRow label="TTL Average" value={mlFeatures.ttl_avg?.toFixed(0) ?? 'N/A'} unit="seconds" />
            <FeatureRow label="ASN Number" value={mlFeatures.asn_number ?? 'N/A'} />
            <FeatureRow label="Reverse DNS Entropy" value={mlFeatures.reverse_dns_entropy?.toFixed(4) ?? 'N/A'} />
          </CardContent>
        </PremiumCard>

        {/* Similarity Scores */}
        <PremiumCard>
          <CardHeader className="border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Image size={20} className="text-primary" />
              </div>
              <h3 className="text-lg font-bold text-text tracking-wide">Similarity Analysis</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <FeatureRow 
              label="SSIM Score" 
              value={!Number.isNaN(mlFeatures.ssim_score) && mlFeatures.ssim_score != null ? (mlFeatures.ssim_score * 100).toFixed(1) : 'N/A'}
              unit={!Number.isNaN(mlFeatures.ssim_score) && mlFeatures.ssim_score != null ? "%" : undefined}
              progress={!Number.isNaN(mlFeatures.ssim_score) && mlFeatures.ssim_score != null ? mlFeatures.ssim_score : undefined}
            />
            <FeatureRow 
              label="Favicon Similarity" 
              value={!Number.isNaN(mlFeatures.favicon_similarity_score) && mlFeatures.favicon_similarity_score != null ? (mlFeatures.favicon_similarity_score * 100).toFixed(1) : 'N/A'}
              unit={!Number.isNaN(mlFeatures.favicon_similarity_score) && mlFeatures.favicon_similarity_score != null ? "%" : undefined}
              progress={!Number.isNaN(mlFeatures.favicon_similarity_score) && mlFeatures.favicon_similarity_score != null ? mlFeatures.favicon_similarity_score : undefined}
            />
            <div className="pt-4 text-xs text-text-secondary">
              <p>Higher similarity scores may indicate brand impersonation</p>
            </div>
          </CardContent>
        </PremiumCard>
      </div>

      {/* Domain Info */}
      <PremiumCard className="bg-surface/40">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Globe size={20} className="text-primary mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-text mb-1">Analyzed URL</h4>
              <p className="text-sm text-text-secondary break-all">{mlFeatures.url}</p>
              <p className="text-sm text-text-secondary mt-1">Domain: <span className="font-medium">{mlFeatures.domain}</span></p>
            </div>
          </div>
        </CardContent>
      </PremiumCard>
    </div>
  );
};

// Helper component for feature rows
const FeatureRow: React.FC<{
  label: string;
  value: string | number;
  unit?: string;
  highlight?: boolean;
  progress?: number;
}> = ({ label, value, unit, highlight, progress }) => {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0 hover:bg-surface/30 px-3 -mx-3 rounded-lg transition-colors">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <div className="flex items-center gap-3">
        {progress !== undefined && (
          <div className="w-24 bg-border/50 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
        <span className={`text-sm font-bold ${highlight ? 'text-danger drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'text-text'}`}>
          {value}{unit && ` ${unit}`}
        </span>
      </div>
    </div>
  );
};
