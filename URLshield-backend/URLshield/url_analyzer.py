"""
Enhanced URL-only analysis for phishing detection.
Uses offline libraries to detect phishing without scraping.
"""

import re
import math
from typing import Dict, List, Tuple
from collections import Counter

# Robust imports: fall back gracefully when compiled extensions are unavailable.
# This is common on Windows when python-Levenshtein wheels are missing.
try:
    import Levenshtein
except ImportError:  # pragma: no cover
    Levenshtein = None  # type: ignore

from fuzzywuzzy import fuzz

try:
    from confusable_homoglyphs import confusables
except ImportError:  # pragma: no cover
    confusables = None  # type: ignore

try:
    from scipy.stats import entropy as scipy_entropy
except ImportError:  # pragma: no cover
    scipy_entropy = None  # type: ignore

import tldextract
from publicsuffix2 import get_sld, get_tld, PublicSuffixList


def _fallback_levenshtein(a: str, b: str) -> int:
    """Pure-Python Levenshtein distance (O(len(a)*len(b)))."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost))
        prev = cur
    return prev[-1]


# Known brand domains for typosquatting detection
KNOWN_BRANDS = [
    'google', 'facebook', 'amazon', 'apple', 'microsoft', 'paypal', 'netflix',
    'instagram', 'twitter', 'linkedin', 'ebay', 'alibaba', 'walmart', 'target',
    'chase', 'wellsfargo', 'bankofamerica', 'citibank', 'americanexpress',
    'visa', 'mastercard', 'discover', 'adobe', 'dropbox', 'github', 'yahoo',
    'outlook', 'gmail', 'icloud', 'whatsapp', 'telegram', 'signal', 'zoom',
    'airtel', 'vodafone', 'jio', 'bsnl', 'idea', 'airbnb', 'uber', 'lyft'
]

# Suspicious TLDs commonly used in phishing
SUSPICIOUS_TLDS = [
    'tk', 'ml', 'ga', 'cf', 'gq',  # Free TLDs
    'xyz', 'top', 'work', 'click', 'link', 'online', 'site',  # Cheap TLDs
    'pw', 'cc', 'ws', 'info', 'biz'  # Often abused
]

# Suspicious keywords in URLs
SUSPICIOUS_KEYWORDS = [
    'login', 'signin', 'account', 'verify', 'secure', 'update', 'confirm',
    'banking', 'paypal', 'ebay', 'amazon', 'apple', 'microsoft', 'password',
    'suspended', 'locked', 'unusual', 'activity', 'urgent', 'action', 'required'
]


def calculate_shannon_entropy(text: str, use_scipy: bool = False) -> float:
    """
    Calculate Shannon entropy of a string.
    Higher entropy = more randomness (suspicious for domains)
    
    Normal domains: 2.0-3.5
    Suspicious domains: > 3.5
    Highly suspicious: > 4.0
    
    Parameters:
    - text: String to analyze
    - use_scipy: If True, use scipy.stats.entropy (more accurate for large datasets)
    """
    if not text:
        return 0.0
    
    # Count character frequencies
    counter = Counter(text.lower())
    length = len(text)
    
    if use_scipy and scipy_entropy is not None:
        # Use scipy's entropy function (base 2 for bits)
        counts = list(counter.values())
        return float(scipy_entropy(counts, base=2))
    else:
        # Manual calculation (faster for small strings)
        probabilities = [count / length for count in counter.values()]
        return -sum(p * math.log2(p) for p in probabilities if p > 0)


def detect_typosquatting(domain: str, threshold: int = 3) -> Dict[str, any]:
    """
    Detect typosquatting using Levenshtein distance and fuzzy matching.
    Returns closest brand match and distance.
    """
    domain_clean = domain.lower().replace('-', '').replace('.', '')
    
    closest_brand = None
    min_distance = float('inf')
    similarity_score = 0
    fuzzy_ratio = 0
    
    for brand in KNOWN_BRANDS:
        # Levenshtein distance (exact character differences)
        if Levenshtein is not None:
            distance = Levenshtein.distance(domain_clean, brand)
        else:
            distance = _fallback_levenshtein(domain_clean, brand)
        
        # Fuzzy matching (phonetic and partial similarity)
        fuzzy_score = fuzz.ratio(domain_clean, brand)
        
        if distance < min_distance:
            min_distance = distance
            closest_brand = brand
            fuzzy_ratio = fuzzy_score
            # Calculate similarity percentage
            max_len = max(len(domain_clean), len(brand))
            similarity_score = (1 - distance / max_len) * 100
    
    # Enhanced detection: typosquatting if Levenshtein <= threshold OR fuzzy ratio > 80
    is_typosquatting = (min_distance <= threshold and min_distance > 0) or fuzzy_ratio > 80
    
    return {
        'is_typosquatting': is_typosquatting,
        'closest_brand': closest_brand,
        'levenshtein_distance': min_distance,
        'fuzzy_ratio': fuzzy_ratio,
        'similarity_percentage': round(similarity_score, 2),
        'severity': 'high' if min_distance == 1 else ('medium' if min_distance <= 2 else 'low')
    }


def detect_homograph_attack(domain: str) -> Dict[str, any]:
    """
    Detect IDN homograph attacks (Unicode lookalike characters).
    Example: аpple.com (Cyrillic 'а') vs apple.com (Latin 'a')
    """
    if confusables is None:
        return {
            'has_homograph': False,
            'confusable_count': 0,
            'confusable_chars': [],
            'severity': 'none',
            'note': 'confusable-homoglyphs not installed; homograph detection disabled'
        }

    has_confusables = False
    confusable_chars = []

    for char in domain:
        if confusables.is_confusable(char, greedy=True):
            has_confusables = True
            # Get lookalike characters
            lookalikes = confusables.is_confusable(char, greedy=True, preferred_aliases=['LATIN'])
            if lookalikes:
                confusable_chars.append({
                    'char': char,
                    'lookalikes': lookalikes
                })

    return {
        'has_homograph': has_confusables,
        'confusable_count': len(confusable_chars),
        'confusable_chars': confusable_chars[:5],  # Limit to first 5
        'severity': 'high' if has_confusables else 'none'
    }


def analyze_tld(url: str) -> Dict[str, any]:
    """
    Analyze TLD for suspicious patterns using tldextract and publicsuffix2.
    """
    extracted = tldextract.extract(url)
    tld = extracted.suffix.lower()
    
    is_suspicious_tld = any(suspicious in tld for suspicious in SUSPICIOUS_TLDS)
    
    # Check for unusual TLD combinations
    tld_parts = tld.split('.')
    has_multiple_tlds = len(tld_parts) > 1
    
    # Use publicsuffix2 for additional validation
    psl = PublicSuffixList()
    try:
        # Get the public suffix (TLD)
        public_suffix = get_tld(url)
        # Get second-level domain (e.g., 'example' in 'example.com')
        sld = get_sld(url)
        
        # Check if it's a valid public suffix
        is_valid_tld = public_suffix is not None
        
        # Detect if using a subdomain of a public suffix (common in phishing)
        # e.g., phishing.github.io, malicious.blogspot.com
        is_public_suffix_subdomain = (
            sld and public_suffix and 
            sld != extracted.domain and
            public_suffix in ['github.io', 'blogspot.com', 'wordpress.com', 'wixsite.com']
        )
    except Exception:
        is_valid_tld = True  # Assume valid if parsing fails
        is_public_suffix_subdomain = False
        sld = None
    
    return {
        'tld': tld,
        'is_suspicious': is_suspicious_tld,
        'has_multiple_tlds': has_multiple_tlds,
        'tld_parts': tld_parts,
        'is_valid_tld': is_valid_tld,
        'second_level_domain': sld,
        'is_public_suffix_subdomain': is_public_suffix_subdomain,
        'severity': 'high' if (is_suspicious_tld or is_public_suffix_subdomain) else 'low'
    }


def detect_suspicious_patterns(url: str, domain: str) -> Dict[str, any]:
    """
    Detect various suspicious patterns in URL.
    """
    url_lower = url.lower()
    domain_lower = domain.lower()
    
    # Check for suspicious keywords
    found_keywords = [kw for kw in SUSPICIOUS_KEYWORDS if kw in url_lower]
    
    # Check for IP address in domain
    ip_pattern = r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}'
    has_ip = bool(re.search(ip_pattern, domain))
    
    # Check for excessive hyphens (common in phishing)
    hyphen_count = domain.count('-')
    excessive_hyphens = hyphen_count > 3
    
    # Check for excessive subdomains
    subdomain_count = domain.count('.') - 1  # Subtract TLD dot
    excessive_subdomains = subdomain_count > 3
    
    # Check for mixed character types (numbers + letters in unusual patterns)
    has_number_letter_mix = bool(re.search(r'[0-9][a-z]|[a-z][0-9]', domain_lower))
    
    # Check for @ symbol (URL obfuscation)
    has_at_symbol = '@' in url
    
    # Check for double slashes in path (obfuscation)
    has_double_slash = '//' in url.split('://', 1)[-1]
    
    return {
        'suspicious_keywords': found_keywords,
        'keyword_count': len(found_keywords),
        'has_ip_address': has_ip,
        'excessive_hyphens': excessive_hyphens,
        'hyphen_count': hyphen_count,
        'excessive_subdomains': excessive_subdomains,
        'subdomain_count': subdomain_count,
        'has_number_letter_mix': has_number_letter_mix,
        'has_at_symbol': has_at_symbol,
        'has_double_slash': has_double_slash,
        'risk_score': sum([
            len(found_keywords) * 2,
            has_ip * 3,
            excessive_hyphens * 2,
            excessive_subdomains * 2,
            has_number_letter_mix * 1,
            has_at_symbol * 3,
            has_double_slash * 2
        ])
    }


def analyze_character_frequency(domain: str) -> Dict[str, any]:
    """
    Analyze character frequency distribution.
    Phishing domains often have unusual character distributions.
    """
    if not domain:
        return {'is_suspicious': False, 'score': 0}
    
    # Remove TLD for analysis
    domain_clean = domain.split('.')[0].lower()
    
    # Count character types
    vowel_count = sum(1 for c in domain_clean if c in 'aeiou')
    consonant_count = sum(1 for c in domain_clean if c.isalpha() and c not in 'aeiou')
    digit_count = sum(1 for c in domain_clean if c.isdigit())
    special_count = sum(1 for c in domain_clean if not c.isalnum())
    
    total_chars = len(domain_clean)
    if total_chars == 0:
        return {'is_suspicious': False, 'score': 0}
    
    # Calculate ratios
    vowel_ratio = vowel_count / total_chars
    digit_ratio = digit_count / total_chars
    special_ratio = special_count / total_chars
    
    # Suspicious if:
    # - Very low vowel ratio (< 0.2) or very high (> 0.6)
    # - High digit ratio (> 0.3)
    # - Any special characters
    is_suspicious = (
        vowel_ratio < 0.2 or vowel_ratio > 0.6 or
        digit_ratio > 0.3 or
        special_ratio > 0
    )
    
    suspicion_score = 0
    if vowel_ratio < 0.2 or vowel_ratio > 0.6:
        suspicion_score += 2
    if digit_ratio > 0.3:
        suspicion_score += 3
    if special_ratio > 0:
        suspicion_score += 2
    
    return {
        'is_suspicious': is_suspicious,
        'vowel_ratio': round(vowel_ratio, 3),
        'digit_ratio': round(digit_ratio, 3),
        'special_ratio': round(special_ratio, 3),
        'suspicion_score': suspicion_score
    }


def comprehensive_url_analysis(url: str, domain: str) -> Dict[str, any]:
    """
    Perform comprehensive offline URL analysis.
    Combines all detection methods.
    """
    # Extract domain parts
    extracted = tldextract.extract(url)
    base_domain = extracted.domain
    
    # Calculate Shannon entropy
    domain_entropy = calculate_shannon_entropy(base_domain)
    url_entropy = calculate_shannon_entropy(url)
    
    # Detect typosquatting
    typosquatting = detect_typosquatting(base_domain)
    
    # Detect homograph attacks
    homograph = detect_homograph_attack(domain)
    
    # Analyze TLD
    tld_analysis = analyze_tld(url)
    
    # Detect suspicious patterns
    patterns = detect_suspicious_patterns(url, domain)
    
    # Analyze character frequency
    char_freq = analyze_character_frequency(base_domain)
    
    # Calculate overall risk score (0-100)
    risk_score = min(100, sum([
        (domain_entropy - 2.5) * 10 if domain_entropy > 2.5 else 0,  # Entropy contribution
        typosquatting['levenshtein_distance'] * 5 if typosquatting['is_typosquatting'] else 0,
        homograph['confusable_count'] * 10,
        20 if tld_analysis['is_suspicious'] else 0,
        patterns['risk_score'],
        char_freq['suspicion_score'] * 2
    ]))
    
    # Determine overall verdict
    if risk_score > 70:
        verdict = 'highly_suspicious'
    elif risk_score > 40:
        verdict = 'suspicious'
    elif risk_score > 20:
        verdict = 'potentially_suspicious'
    else:
        verdict = 'likely_safe'
    
    return {
        'verdict': verdict,
        'risk_score': round(risk_score, 2),
        'entropy': {
            'domain': round(domain_entropy, 3),
            'url': round(url_entropy, 3),
            'is_high': domain_entropy > 3.5
        },
        'typosquatting': typosquatting,
        'homograph': homograph,
        'tld': tld_analysis,
        'patterns': patterns,
        'character_frequency': char_freq,
        'recommendations': generate_recommendations(
            typosquatting, homograph, tld_analysis, patterns, domain_entropy
        )
    }


def generate_recommendations(typosquatting: Dict, homograph: Dict, 
                            tld: Dict, patterns: Dict, entropy: float) -> List[str]:
    """
    Generate human-readable recommendations based on analysis.
    """
    recommendations = []
    
    if typosquatting['is_typosquatting']:
        recommendations.append(
            f"⚠️ Domain closely resembles '{typosquatting['closest_brand']}' "
            f"(similarity: {typosquatting['similarity_percentage']}%) - possible typosquatting"
        )
    
    if homograph['has_homograph']:
        recommendations.append(
            f"🚨 Contains {homograph['confusable_count']} lookalike Unicode characters - "
            "possible homograph attack"
        )
    
    if tld['is_suspicious']:
        recommendations.append(
            f"⚠️ Uses suspicious TLD '.{tld['tld']}' - commonly used in phishing"
        )
    
    if entropy > 4.0:
        recommendations.append(
            f"🔍 High randomness detected (entropy: {entropy:.2f}) - "
            "may be algorithmically generated"
        )
    
    if patterns['has_ip_address']:
        recommendations.append(
            "🚨 Contains IP address instead of domain name - highly suspicious"
        )
    
    if patterns['keyword_count'] > 0:
        recommendations.append(
            f"⚠️ Contains {patterns['keyword_count']} suspicious keywords: "
            f"{', '.join(patterns['suspicious_keywords'][:3])}"
        )
    
    if patterns['has_at_symbol']:
        recommendations.append(
            "🚨 Contains @ symbol - possible URL obfuscation technique"
        )
    
    if not recommendations:
        recommendations.append("✅ No obvious red flags detected in URL structure")
    
    return recommendations

