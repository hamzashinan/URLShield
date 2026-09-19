import type { JobDetail, MLFeatures } from '../types/api';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown';
export type ThreatCategory = 'phishing' | 'suspected' | 'safe' | 'unknown';

export interface SecurityClassification {
  /** Human-readable category */
  category: ThreatCategory;
  /** Machine-readable risk tier */
  riskLevel: RiskLevel;
  /** Display label for badges */
  label: string;
  /** Short summary of why this classification was chosen */
  explanation: string;
  /** Tailwind color token for UI theming */
  color: string;
  /** Badge variant name */
  badgeVariant: 'danger' | 'warning' | 'success' | 'default';
  /** 0–1 numeric confidence */
  confidence: number;
  /** 0–1 numeric risk score (higher = riskier) */
  riskScore: number;
}

/**
 * Score individual ML feature risk signals (0–1 each)
 */
function scoreFeatures(features: MLFeatures | null | undefined): {
  tunnelingRisk: number;
  httpsRisk: number;
  domainAgeRisk: number;
  typoRisk: number;
  misleadingRisk: number;
  brandRisk: number;
} {
  const f = features;
  if (!f) {
    return {
      tunnelingRisk: 0,
      httpsRisk: 0,
      domainAgeRisk: 0,
      typoRisk: 0,
      misleadingRisk: 0,
      brandRisk: 0,
    };
  }

  // DNS tunneling: binary or numeric
  const tunneling =
    typeof f.Is_Tunneling === 'number'
      ? f.Is_Tunneling
      : f.Is_Tunneling === 'yes' || f.Is_Tunneling === '1' ? 1 : 0;

  // No HTTPS
  const noHttps =
    typeof f.HTTPS === 'string'
      ? f.HTTPS === 'no' || f.HTTPS === '0'
        ? 1
        : 0
      : f.HTTPS === 0
        ? 1
        : 0;

  // Very new domain (< 30 days)
  const domainAgeRisk =
    typeof f.domain_age_days === 'number'
      ? f.domain_age_days < 7
        ? 1
        : f.domain_age_days < 30
          ? 0.7
          : f.domain_age_days < 90
            ? 0.3
            : 0
      : 0;

  // Typosquatting score (can be string from some backends)
  const typoScore =
    typeof f.typosquatting_score === 'number'
      ? f.typosquatting_score
      : parseFloat((f.typosquatting_score as string) || '0') || 0;

  // Misleading keyword present
  const misleading =
    typeof f.misleading_keyword_present === 'number'
      ? f.misleading_keyword_present
      : 0;

  // Brand word present (often used in phishing to impersonate)
  const brand =
    typeof f.brand_word_present === 'number' ? f.brand_word_present : 0;

  return {
    tunnelingRisk: tunneling,
    httpsRisk: noHttps,
    domainAgeRisk,
    typoRisk: typoScore,
    misleadingRisk: misleading,
    brandRisk: brand,
  };
}

/**
 * Combine prediction, confidence, and raw ML features into a single
 * SecurityClassification object.
 */
export function classifySecurityRisk(
  job: JobDetail | null | undefined
): SecurityClassification {
  if (!job) {
    return {
      category: 'unknown',
      riskLevel: 'unknown',
      label: 'Unknown',
      explanation: 'No analysis data available.',
      color: 'text-text-secondary',
      badgeVariant: 'default',
      confidence: 0,
      riskScore: 0,
    };
  }

  const pred = job.ml_prediction;
  const features = job.ml_features;
  const featureScores = scoreFeatures(features);

  // Base values from ML prediction
  const rawPrediction = (pred?.prediction || 'unknown').toLowerCase().trim();
  const confidence = pred?.confidence ?? 0;
  const riskScore = pred?.risk_score ?? confidence;

  // Aggregate feature risk (0–1)
  const featureRisk = Math.min(
    1,
    featureScores.tunnelingRisk +
      featureScores.httpsRisk * 0.4 +
      featureScores.domainAgeRisk * 0.5 +
      featureScores.typoRisk * 0.6 +
      featureScores.misleadingRisk * 0.7 +
      featureScores.brandRisk * 0.4
  );

  // Combined risk score weighted toward model output
  const combinedRisk = Math.min(
    1,
    riskScore * 0.6 + featureRisk * 0.4
  );

  let category: ThreatCategory;
  let riskLevel: RiskLevel;
  let label: string;
  let explanation: string;
  let color: string;
  let badgeVariant: 'danger' | 'warning' | 'success' | 'default';

  if (rawPrediction === 'phishing') {
    if (confidence >= 0.85 || combinedRisk >= 0.85) {
      category = 'phishing';
      riskLevel = 'critical';
      label = 'Phishing (Critical)';
      color = 'text-danger';
      badgeVariant = 'danger';
    } else if (confidence >= 0.6 || combinedRisk >= 0.6) {
      category = 'phishing';
      riskLevel = 'high';
      label = 'Phishing (High)';
      color = 'text-danger';
      badgeVariant = 'danger';
    } else {
      category = 'phishing';
      riskLevel = 'medium';
      label = 'Phishing (Medium)';
      color = 'text-warning';
      badgeVariant = 'warning';
    }

    const reasons: string[] = [];
    if (confidence >= 0.8) reasons.push('high model confidence');
    if (featureScores.tunnelingRisk > 0) reasons.push('DNS tunneling detected');
    if (featureScores.httpsRisk > 0) reasons.push('no HTTPS');
    if (featureScores.domainAgeRisk > 0)
      reasons.push('newly registered domain');
    if (featureScores.typoRisk > 0.5) reasons.push('typosquatting indicators');
    if (featureScores.misleadingRisk > 0)
      reasons.push('misleading keywords found');
    if (featureScores.brandRisk > 0) reasons.push('brand impersonation signals');

    explanation =
      reasons.length > 0
        ? `${reasons.join('; ')}.`
        : 'ML model flagged this URL as phishing.';
  } else if (rawPrediction === 'suspected') {
    category = 'suspected';
    riskLevel = combinedRisk >= 0.6 ? 'high' : 'medium';
    label = riskLevel === 'high' ? 'Suspected (High)' : 'Suspected';
    color = 'text-warning';
    badgeVariant = 'warning';

    const reasons: string[] = [];
    if (featureScores.httpsRisk > 0) reasons.push('no HTTPS');
    if (featureScores.domainAgeRisk > 0)
      reasons.push('newly registered domain');
    if (featureScores.typoRisk > 0.3) reasons.push('similarity to known brand');
    if (featureScores.misleadingRisk > 0)
      reasons.push('misleading keywords found');
    if (featureScores.brandRisk > 0) reasons.push('brand impersonation signals');

    explanation =
      reasons.length > 0
        ? `Suspicious indicators: ${reasons.join('; ')}.`
        : 'Some suspicious patterns detected; review recommended.';
  } else if (rawPrediction === 'legitimate') {
    category = 'safe';
    if (confidence >= 0.85 && combinedRisk < 0.2) {
      riskLevel = 'low';
      label = 'Safe';
    } else {
      riskLevel = 'low';
      label = 'Safe (Low Confidence)';
    }
    color = 'text-success';
    badgeVariant = 'success';
    explanation =
      'No significant phishing indicators detected. URL appears legitimate.';
  } else {
    category = 'unknown';
    riskLevel = 'unknown';
    label = 'Unknown';
    color = 'text-text-secondary';
    badgeVariant = 'default';
    explanation = 'Analysis inconclusive or incomplete.';
  }

  return {
    category,
    riskLevel,
    label,
    explanation,
    color,
    badgeVariant,
    confidence,
    riskScore: combinedRisk,
  };
}

/**
 * Quick helper: is this result dangerous enough to warrant an alert?
 */
export function shouldAlert(classification: SecurityClassification): boolean {
  return classification.category === 'phishing' || classification.category === 'suspected';
}
