import math
import re
import sys
import socket
import time
import subprocess
import json
from collections import Counter
from functools import lru_cache
from io import BytesIO
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import numpy as np
import pandas as pd
import requests
from PIL import Image
import imagehash
import dns.resolver
import dns.reversename
from ipwhois import IPWhois

# Suppress SSL warnings for favicon fetching (some phishing sites have invalid SSL)
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ============================================================================
# NETWORK CONFIGURATION
# ============================================================================
# Configurable timeouts for different network operations
# Optimized for faster URL analysis - reduce these if analysis is too slow
TIMEOUT_DNS = 2.0          # DNS resolution timeout (seconds) - reduced from 5s
TIMEOUT_WHOIS = 5.0        # WHOIS lookup timeout (seconds) - reduced from 10s
TIMEOUT_HTTPS = 4.0        # HTTPS probe timeout (seconds) - reduced from 8s
TIMEOUT_FAVICON = 5.0      # Favicon fetch timeout (seconds) - reduced from 8s
TIMEOUT_SCREENSHOT = 10.0  # Screenshot fetch timeout (seconds) - reduced from 15s

# Retry configuration - reduced for faster analysis
MAX_RETRIES = 1            # Number of retry attempts - reduced from 2
RETRY_DELAY = 0.5          # Delay between retries (seconds) - reduced from 1s

# WHOIS rate limiting configuration
# WHOIS servers are rate-limited; add delays between requests to avoid blocking
WHOIS_RATE_LIMIT_DELAY = 0.2  # Delay between WHOIS requests (seconds) - reduced from 0.5s
WHOIS_CACHE_TIMEOUT = 86400    # Cache WHOIS results for 24 hours (seconds)

# Screenshot fetching configuration
# Screenshot fetching is slow and resource-intensive; can be disabled to speed up processing
ENABLE_SCREENSHOT_FETCH = True  # Set to False to skip SSIM computation (faster)
SCREENSHOT_MAX_RETRIES = 1      # Max retries for screenshot fetch (fewer than other operations)
SCREENSHOT_RETRY_DELAY = 0.5    # Delay between screenshot retries (seconds)
ENABLE_WAYBACK_FALLBACK = False  # Try Internet Archive (disabled due to rate limits)

# Lightning-speed feature switches (disable network-heavy fetches)
ENABLE_WHOIS = True
ENABLE_HOSTING_LOOKUPS = True
ENABLE_FAVICON = True
ENABLE_REVERSE_DNS = True
ENABLE_DNS_TTL = True
ENABLE_HTTPS_PROBE = True
ENABLE_DOMAIN_CHECKS = True
ENABLE_SCREENSHOT_FETCH = True
USE_DOMAIN_SIMILARITY_FALLBACK = False  # Use domain name similarity when visual comparison fails

# ============================================================================
# WHOIS Rate Limiter
# ============================================================================
import threading
from collections import defaultdict
from time import time as time_now

class RateLimiter:
    """Rate limiter to prevent WHOIS server blocking."""
    def __init__(self, delay: float = 0.5):
        self.delay = delay
        self.last_request_time = 0.0
        self.lock = threading.Lock()
    
    def wait(self):
        """Wait if necessary to respect rate limit."""
        with self.lock:
            elapsed = time_now() - self.last_request_time
            if elapsed < self.delay:
                time.sleep(self.delay - elapsed)
            self.last_request_time = time_now()

whois_limiter = RateLimiter(WHOIS_RATE_LIMIT_DELAY)

# ============================================================================


def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    counts = Counter(s)
    total = len(s)
    ent = 0.0
    for c in counts.values():
        p = c / total
        ent -= p * math.log2(p)
    return ent


def is_ipv4(host: str) -> bool:
    if not host:
        return False
    parts = host.split('.')
    if len(parts) != 4:
        return False
    for p in parts:
        if not p.isdigit():
            return False
        v = int(p)
        if v < 0 or v > 255:
            return False
    return True


def count_subdomains(host: str) -> int:
    if not host:
        return 0
    # Remove possible leading 'www.'
    if host.startswith('www.'):
        host = host[4:]
    # Count labels minus 2 (domain + tld), min 0
    labels = host.split('.')
    return max(0, len(labels) - 2)


def num_dots(s: str) -> int:
    return s.count('.')


def num_hyphens_domain(host: str) -> int:
    return host.count('-') if host else 0


def num_special_characters(url: str) -> int:
    if not url:
        return 0
    # Consider non-alphanumeric characters as special
    return sum(1 for ch in url if not ch.isalnum())


def is_idn_domain(host: str) -> int:
    if not host:
        return 0
    try:
        host.encode('ascii')
        # Punycode prefix indicates IDN
        return 1 if 'xn--' in host else 0
    except Exception:
        # Non-ascii present
        return 1


def edit_distance(a: str, b: str) -> int:
    # Levenshtein distance (iterative, O(len(a)*len(b)))
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
            cur.append(min(
                prev[j] + 1,      # deletion
                cur[j - 1] + 1,   # insertion
                prev[j - 1] + cost  # substitution
            ))
        prev = cur
    return prev[-1]


DEFAULT_BRANDS = [
    'sbi', 'icici', 'bankofbaroda', 'crsorgi', 'hdfcbank', 'ncrb', 'airtel',
    'hdfclife', 'hdfc', 'mgovcloud', 'hdfcergo', 'iocl', 'icicilombard',
    'iciciprulife', 'irctc', 'pnb', 'pnbindia', 'sbilife', 'sbicard'
]


MISLEADING_KEYWORDS = [
    'login', 'verify', 'secure', 'update', 'account', 'confirm', 'payment',
    'support', 'helpdesk', 'password', 'invoice', 'billing', 'unlock', 'reset',
    'signin', 'signup', 'register', 'activate', 'validate', 'authenticate',
    'authorize', 'access', 'permission', 'approval', 'request', 'submit',
    'urgent', 'alert', 'warning', 'action', 'required', 'immediate',
    'expire', 'expired', 'expiry', 'deadline', 'limited', 'offer',
    'claim', 'reward', 'prize', 'bonus', 'cashback', 'discount',
    'refund', 'transaction', 'transfer', 'withdraw', 'deposit', 'balance',
    'kyc', 'aadhar', 'pan', 'gstin', 'ifsc', 'micr',
    'otp', 'cvv', 'pin', 'atm', 'debit', 'credit',
    'bank', 'branch', 'account', 'savings', 'current', 'loan',
    'insurance', 'policy', 'premium', 'claim', 'health', 'life',
    'tax', 'income', 'return', 'filing', 'assessment', 'notice',
    'aadhaar', 'voter', 'passport', 'license', 'permit', 'certificate',
    'government', 'ministry', 'department', 'authority', 'agency', 'office',
    'railway', 'irctc', 'ticket', 'booking', 'reservation', 'cancellation',
    'electricity', 'water', 'gas', 'bill', 'payment', 'dues',
    'school', 'college', 'university', 'exam', 'result', 'admission',
    'hospital', 'doctor', 'appointment', 'prescription', 'medicine', 'treatment',
    'job', 'employment', 'recruitment', 'interview', 'resume', 'vacancy',
    'ecommerce', 'shopping', 'order', 'delivery', 'tracking', 'return',
    'social', 'media', 'profile', 'friend', 'message', 'notification',
    'email', 'mailbox', 'inbox', 'spam', 'phishing', 'malware'
]


SHORTENER_DOMAINS = {
    'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd', 'buff.ly',
    'bitly.com', 'cutt.ly', 'tiny.cc', 'rebrand.ly'
}


# Legitimate domains for automatic matching when 'Corresponding CSE Domain Name' is not available
LEGITIMATE_DOMAINS = [
    'accounts.mgovcloud.in',
    'airtel.in',
    'bankofbaroda.in',
    'dc.crsorgi.gov.in',
    'email.gov.in',
    'hdfcbank.com',
    'hdfcergo.com',
    'icicibank.com',
    'iocl.com',
    'irctc.co.in',
    'kavach.mail.gov.in',
    'ncrb.gov.in',
    'pnbindia.in',
    'sbi.co.in',
    'sbicard.com',
    'sbilife.co.in'
]


def find_best_matching_legitimate_domain(suspicious_url: str) -> str:
    """Find the most matching legitimate domain from LEGITIMATE_DOMAINS.
    
    Uses multiple strategies:
    1. Brand keyword matching (if brand found in URL, match to corresponding legitimate domain)
    2. Edit distance (find domain with minimum edit distance)
    
    Args:
        suspicious_url: The suspicious URL to match
    
    Returns:
        Best matching legitimate domain, or first domain if no good match found
    """
    if not suspicious_url:
        return LEGITIMATE_DOMAINS[0] if LEGITIMATE_DOMAINS else ''
    
    # Extract domain from URL
    parsed = urlparse(suspicious_url if '://' in suspicious_url else f'http://{suspicious_url}')
    domain = parsed.netloc.lower() if parsed.netloc else suspicious_url.lower()
    
    # Remove 'www.' prefix if present
    if domain.startswith('www.'):
        domain = domain[4:]
    
    # Strategy 1: Brand keyword matching
    # Map brand keywords to legitimate domains
    brand_to_domain = {
        'sbi': 'sbi.co.in',
        'sbicard': 'sbicard.com',
        'sbilife': 'sbilife.co.in',
        'icici': 'icicibank.com',
        'bankofbaroda': 'bankofbaroda.in',
        'crsorgi': 'dc.crsorgi.gov.in',
        'hdfcbank': 'hdfcbank.com',
        'hdfc': 'hdfcbank.com',
        'hdfcergo': 'hdfcergo.com',
        'ncrb': 'ncrb.gov.in',
        'airtel': 'airtel.in',
        'mgovcloud': 'accounts.mgovcloud.in',
        'iocl': 'iocl.com',
        'irctc': 'irctc.co.in',
        'pnb': 'pnbindia.in',
        'pnbindia': 'pnbindia.in',
    }
    
    # Check if any brand keyword is in the suspicious domain
    for brand, legit_domain in brand_to_domain.items():
        if brand in domain:
            return legit_domain
    
    # Strategy 2: Edit distance - find closest match
    min_distance = float('inf')
    best_match = LEGITIMATE_DOMAINS[0] if LEGITIMATE_DOMAINS else ''
    
    for legit_domain in LEGITIMATE_DOMAINS:
        # Compare domain names using edit distance
        distance = edit_distance(domain, legit_domain)
        if distance < min_distance:
            min_distance = distance
            best_match = legit_domain
    
    return best_match


def extract_domain(host: str) -> str:
    # A very simple public suffix heuristic: take last two labels when possible
    if not host:
        return ''
    labels = host.split('.')
    if len(labels) >= 2:
        return labels[-2]
    return host


# --------------- Networking helpers (cached) ---------------

def _try_python_whois(domain: str):
    """Try python-whois library (Method 1)."""
    try:
        import whois
        w = whois.whois(domain)
        
        # Try multiple date fields
        date_fields = [
            w.creation_date,
            getattr(w, 'registered_date', None),
            w.updated_date if hasattr(w, 'updated_date') else None,
        ]
        
        for date_value in date_fields:
            if date_value is not None:
                if isinstance(date_value, list):
                    valid_dates = [d for d in date_value if d is not None]
                    if valid_dates:
                        return min(valid_dates)
                else:
                    return date_value
    except Exception:
        pass
    return None


def _try_system_whois(domain: str):
    """Try system whois command (Method 2)."""
    try:
        # Try running system whois command
        result = subprocess.run(
            ['whois', domain],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            output = result.stdout.lower()
            
            # Parse common date patterns
            import re
            from datetime import datetime
            
            # Common patterns in whois output
            patterns = [
                r'creation date[:\s]+(\d{4}-\d{2}-\d{2})',
                r'created[:\s]+(\d{4}-\d{2}-\d{2})',
                r'registered[:\s]+(\d{4}-\d{2}-\d{2})',
                r'domain registered[:\s]+(\d{4}-\d{2}-\d{2})',
                r'registration date[:\s]+(\d{4}-\d{2}-\d{2})',
            ]
            
            for pattern in patterns:
                match = re.search(pattern, output)
                if match:
                    date_str = match.group(1)
                    return datetime.strptime(date_str, '%Y-%m-%d')
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
        pass
    return None


def _try_rdap_api(domain: str):
    """Try RDAP (Registration Data Access Protocol) API (Method 3)."""
    try:
        # RDAP bootstrap service
        rdap_url = f'https://rdap.org/domain/{domain}'
        
        response = requests.get(rdap_url, timeout=8)
        if response.status_code == 200:
            data = response.json()
            
            # RDAP uses 'events' array
            events = data.get('events', [])
            for event in events:
                if event.get('eventAction') == 'registration':
                    date_str = event.get('eventDate')
                    if date_str:
                        from datetime import datetime
                        # RDAP dates are ISO 8601 format
                        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except Exception:
        pass
    return None


def _try_whoisxml_api(domain: str):
    """Try WhoisXML API (Method 4 - free tier, no key needed)."""
    try:
        # WhoisXML has a free JSON endpoint (limited)
        url = f'https://www.whoisxmlapi.com/whoisserver/WhoisService?domainName={domain}&outputFormat=JSON'
        
        response = requests.get(url, timeout=8)
        if response.status_code == 200:
            data = response.json()
            
            # Check for creation date in response
            whois_record = data.get('WhoisRecord', {})
            created_date = whois_record.get('createdDate')
            
            if created_date:
                from datetime import datetime
                # Try to parse the date
                try:
                    return datetime.fromisoformat(created_date.replace('Z', '+00:00'))
                except:
                    # Try alternative format
                    return datetime.strptime(created_date[:10], '%Y-%m-%d')
    except Exception:
        pass
    return None


@lru_cache(maxsize=4096)
def get_domain_age_days(domain: str) -> float:
    """Get domain age using MULTIPLE data sources for maximum coverage.
    
    Data sources (in order):
    1. python-whois library (fast, local)
    2. System whois command (if available)
    3. RDAP API (modern, standardized)
    4. WhoisXML API (fallback, web-based)
    
    Returns real domain age from first successful source. Only returns NaN if all sources fail.
    """
    if not domain:
        return float('nan')
    
    # Apply rate limiting before WHOIS requests
    whois_limiter.wait()
    
    from datetime import datetime, timezone
    now = datetime.now(tz=timezone.utc)
    
    # Try each method in sequence
    methods = [
        ('python-whois', _try_python_whois),
        ('system-whois', _try_system_whois),
        ('RDAP-API', _try_rdap_api),
        ('WhoisXML-API', _try_whoisxml_api),
    ]
    
    for method_name, method_func in methods:
        for attempt in range(MAX_RETRIES + 1):
            try:
                creation_date = method_func(domain)
                
                if creation_date is not None:
                    # Ensure timezone-aware
                    if getattr(creation_date, 'tzinfo', None) is None:
                        creation_date = creation_date.replace(tzinfo=timezone.utc)
                    
                    age_days = max(0.0, (now - creation_date).days)
                    return age_days
                    
            except Exception:
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY)
                    continue
                break
        
        # Small delay between different methods
        if method_name != methods[-1][0]:
            time.sleep(0.1)  # Reduced from 0.2s for faster analysis
    
    # All methods failed
    return float('nan')


@lru_cache(maxsize=4096)
def resolve_a_records(domain: str) -> list:
    """Resolve A records for a domain with retry logic and configurable timeout."""
    if not domain:
        return []
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            answers = dns.resolver.resolve(domain, 'A', lifetime=TIMEOUT_DNS)
            return [rdata.address for rdata in answers]
        except dns.resolver.NXDOMAIN:
            # Domain does not exist
            return []
        except dns.resolver.Timeout:
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
                continue
            return []
        except Exception:
            # Silently handle other DNS resolution failures
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
                continue
            return []
    
    return []


@lru_cache(maxsize=4096)
def get_dns_ttl_avg(domain: str) -> float:
    """Get DNS TTL with retry logic and configurable timeout.
    
    Extracts actual TTL value from DNS A records. Multiple methods attempted to ensure
    real TTL value is returned.
    """
    if not domain:
        return float('nan')
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            ans = dns.resolver.resolve(domain, 'A', lifetime=TIMEOUT_DNS)
            
            # Method 1: Try to get TTL from rrset (most common)
            if hasattr(ans, 'rrset') and ans.rrset is not None:
                ttl = getattr(ans.rrset, 'ttl', None)
                if ttl is not None:
                    return float(ttl)
            
            # Method 2: Try to get TTL from response directly
            if hasattr(ans, 'response') and ans.response is not None:
                # Check answer section for TTL
                for rrset in ans.response.answer:
                    if rrset.rdtype == dns.rdatatype.A:
                        return float(rrset.ttl)
            
            # Method 3: Iterate through answer records
            ttl_values = []
            for rdata in ans:
                # Each rdata is part of an rrset that has TTL
                if hasattr(ans, 'rrset') and ans.rrset:
                    ttl_values.append(float(ans.rrset.ttl))
                    break
            
            if ttl_values:
                return sum(ttl_values) / len(ttl_values)
            
            # If we got here but have answers, try one more approach
            # Access the TTL from the answer's parent rrset
            try:
                # The answer object's rrset should have TTL
                if len(ans) > 0:
                    # Try to get from the canonical name resolution
                    return float(ans.rrset.ttl) if ans.rrset else float('nan')
            except:
                pass
            
            return float('nan')
            
        except dns.resolver.NXDOMAIN:
            # Domain doesn't exist - no TTL available
            return float('nan')
        except dns.resolver.NoAnswer:
            # DNS responded but no A record - no TTL available
            return float('nan')
        except dns.resolver.NoNameservers:
            # No nameservers responded - cannot get TTL
            return float('nan')
        except dns.resolver.Timeout:
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
                continue
            return float('nan')
        except Exception as e:
            # Other DNS errors - retry if attempts remain
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
                continue
            return float('nan')
    
    return float('nan')


@lru_cache(maxsize=4096)
def get_asn_and_country(domain: str) -> tuple:
    """Get ASN number and country with retry logic and multiple lookup methods.
    
    Returns real ASN values from IPWhois lookups. Uses RDAP (primary) and WHOIS (fallback).
    """
    if not domain:
        return float('nan'), np.nan
    
    ips = resolve_a_records(domain)
    if not ips:
        # No IPs resolved - cannot get ASN
        return float('nan'), np.nan
    
    # Try each IP (usually first one succeeds)
    for ip in ips:
        for attempt in range(MAX_RETRIES + 1):
            try:
                # Method 1: Try RDAP lookup (recommended, faster)
                try:
                    info = IPWhois(ip).lookup_rdap(asn_methods=['whois', 'http'])
                    asn = info.get('asn')
                    country = (info.get('asn_country_code')
                               or info.get('network', {}).get('country'))
                    
                    # Return if we got ASN or country
                    if asn or country:
                        # Parse ASN number (remove 'AS' prefix if present)
                        try:
                            asn_num = int(str(asn).lstrip('ASas')) if asn else float('nan')
                        except (ValueError, AttributeError):
                            asn_num = float('nan')
                        return asn_num, (country or np.nan)
                
                except Exception:
                    # Method 2: Fallback to WHOIS lookup
                    try:
                        info = IPWhois(ip).lookup_whois()
                        asn = info.get('asn')
                        country = info.get('asn_country_code')
                        
                        if asn or country:
                            try:
                                asn_num = int(str(asn).lstrip('ASas')) if asn else float('nan')
                            except (ValueError, AttributeError):
                                asn_num = float('nan')
                            return asn_num, (country or np.nan)
                    except Exception:
                        pass
                
                # If both methods failed but no exception, try next IP
                break
                
            except ConnectionError:
                # Network issue - retry
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY)
                    continue
                break
            except Exception:
                # Other errors - move to next IP
                break
    
    # No successful lookup for any IP
    return float('nan'), np.nan


@lru_cache(maxsize=4096)
def get_reverse_dns_entropy(domain: str) -> float:
    """Get reverse DNS entropy with efficient retry logic and fallback mechanisms.
    
    Returns entropy of reverse DNS names. If no PTR records found, uses domain name itself
    as fallback to ensure a value is returned (more efficient than NaN).
    """
    if not domain:
        return float('nan')
    
    ips = resolve_a_records(domain)
    ptr_names = []
    
    # If no IPs resolved, use domain name as fallback
    if not ips:
        return shannon_entropy(domain)
    
    for ip in ips:
        ptr_found = False
        
        # Try DNS PTR lookup first (with timeout)
        for attempt in range(MAX_RETRIES + 1):
            try:
                rev_name = dns.reversename.from_address(ip)
                ans = dns.resolver.resolve(rev_name, 'PTR', lifetime=TIMEOUT_DNS)
                for r in ans:
                    ptr_names.append(str(r.target).rstrip('.'))
                ptr_found = True
                break  # Success, move to next IP
            except dns.resolver.NXDOMAIN:
                # No PTR record for this IP
                break
            except dns.resolver.Timeout:
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY)
                    continue
                break  # Give up on this IP after retries
            except Exception:
                break  # Try socket fallback
        
        # If DNS PTR failed, try socket as fallback
        if not ptr_found:
            try:
                socket.settimeout(TIMEOUT_DNS)
                h, _, _ = socket.gethostbyaddr(ip)
                ptr_names.append(h)
                socket.settimeout(None)
            except socket.timeout:
                socket.settimeout(None)
            except Exception:
                # Socket also failed, use IP as fallback
                ptr_names.append(ip)
    
    # Use collected PTR names, or fall back to domain name if empty
    if ptr_names:
        joined = ','.join(ptr_names)
    else:
        # Fallback: use domain name itself
        joined = domain
    
    return shannon_entropy(joined)


@lru_cache(maxsize=4096)
def supports_https(domain: str) -> bool:
    """Check HTTPS support with retry logic and configurable timeout."""
    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = requests.head(
                f'https://{domain}/',
                timeout=TIMEOUT_HTTPS,
                allow_redirects=True
            )
            return resp.status_code < 500
        except requests.Timeout:
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
                continue
            return False
        except Exception:
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
                continue
            return False
    
    return False


@lru_cache(maxsize=4096)
def fetch_favicon_hash(domain: str) -> str:
    """Fetch favicon hash with multiple methods for maximum reliability.
    
    Methods:
    1. Parse HTML page to find <link rel="icon"> tags (most reliable)
    2. Try common favicon paths (/favicon.ico, /favicon.png, etc.)
    3. Use perceptual hashing for images
    4. Fallback to content hash for non-images
    
    Returns:
        str: Perceptual hash (for images) or content hash (for non-images)
        Empty string if all methods fail
    """
    if not domain:
        return ''
    
    # Request headers to avoid blocking
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    
    # Method 1: Parse HTML to find favicon link
    favicon_urls = _extract_favicon_from_html(domain, headers)
    
    # Method 2: Add common favicon paths as fallback
    common_paths = [
        '/favicon.ico',
        '/favicon.png',
        '/favicon.jpg',
        '/apple-touch-icon.png',
        '/apple-touch-icon-precomposed.png',
        '/images/favicon.ico',
        '/assets/favicon.ico',
        '/static/favicon.ico',
    ]
    
    # Try favicon URLs from HTML first, then common paths
    all_urls = []
    for fav_url in favicon_urls:
        if fav_url.startswith('http'):
            all_urls.append(fav_url)
        else:
            # Relative URL - try both https and http
            all_urls.append(f'https://{domain}{fav_url}')
            all_urls.append(f'http://{domain}{fav_url}')
    
    # Add common paths
    for path in common_paths:
        all_urls.append(f'https://{domain}{path}')
        all_urls.append(f'http://{domain}{path}')
    
    # Try each URL with retry logic
    for url in all_urls:
        for attempt in range(MAX_RETRIES + 1):
            try:
                # Disable SSL verification for problematic sites, allow redirects
                r = requests.get(
                    url,
                    headers=headers,
                    timeout=TIMEOUT_FAVICON,
                    verify=False,  # Disable SSL verification
                    allow_redirects=True,
                    stream=False
                )
                
                if r.status_code == 200 and r.content and len(r.content) > 0:
                    # Try to hash as image first (perceptual hash)
                    try:
                        img = Image.open(BytesIO(r.content)).convert('RGBA')
                        # Use perceptual hash (more robust than average hash)
                        phash = imagehash.phash(img, hash_size=8)
                        return str(phash)
                    except Exception:
                        # Not a valid image - try as raw bytes
                        try:
                            import hashlib
                            # Use first 100KB to avoid hashing huge files
                            content_sample = r.content[:102400]
                            if len(content_sample) > 100:  # Minimum size check
                                return hashlib.sha256(content_sample).hexdigest()[:16]
                        except Exception:
                            pass
                break  # Non-200 or empty content, try next URL
                
            except requests.Timeout:
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY)
                    continue
                break  # Give up on this URL after retries
            except requests.ConnectionError:
                # Connection failed, try next URL
                break
            except Exception:
                # Other errors, try next URL
                break
    
    return ''


def _extract_favicon_from_html(domain: str, headers: dict) -> list:
    """Extract favicon URLs from HTML <link> tags.
    
    Args:
        domain: Domain name to fetch HTML from
        headers: Request headers
    
    Returns:
        list: List of favicon URLs found in HTML
    """
    favicon_urls = []
    
    # Try to fetch homepage HTML
    for scheme in ['https', 'http']:
        try:
            url = f'{scheme}://{domain}/'
            r = requests.get(
                url,
                headers=headers,
                timeout=TIMEOUT_FAVICON,
                verify=False,
                allow_redirects=True
            )
            
            if r.status_code == 200 and r.content:
                # Parse HTML to find favicon links
                html = r.text.lower()
                
                # Look for <link rel="icon"> or <link rel="shortcut icon">
                import re
                
                # Pattern 1: <link rel="icon" href="...">
                icon_patterns = [
                    r'<link[^>]*rel=["\'](?:shortcut )?icon["\'][^>]*href=["\']([^"\'>]+)["\']',
                    r'<link[^>]*href=["\']([^"\'>]+)["\'][^>]*rel=["\'](?:shortcut )?icon["\']',
                    r'<link[^>]*rel=["\']apple-touch-icon[^"\'>]*["\'][^>]*href=["\']([^"\'>]+)["\']',
                    r'<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\'>]+)["\']',
                ]
                
                for pattern in icon_patterns:
                    matches = re.findall(pattern, html)
                    for match in matches:
                        if match and not match.startswith('data:'):
                            favicon_urls.append(match)
                
                if favicon_urls:
                    break  # Found favicon URLs, no need to try http
                    
        except Exception:
            continue
    
    return favicon_urls


def _calculate_typosquatting_score(edit_distance: int) -> str:
    """Convert edit distance to typosquatting risk category."""
    if edit_distance <= 2:
        return 'High'
    elif edit_distance <= 4:
        return 'Medium'
    else:
        return 'Low'


def compute_favicon_similarity(domain1: str, domain2: str) -> float:
    """Compute similarity between favicons of two domains using perceptual hashing.
    
    Returns:
        float: Similarity score 0.0-1.0 (0 = completely different, 1 = identical)
        NaN only if both domains fail to return any favicon
    """
    if not domain1 or not domain2:
        return float('nan')
    
    try:
        hash1 = fetch_favicon_hash(domain1)
        hash2 = fetch_favicon_hash(domain2)
        
        # If both failed, return NaN (no data to compare)
        if not hash1 and not hash2:
            return float('nan')
        
        # If only one failed, they're completely different (return 0.0)
        if not hash1 or not hash2:
            return 0.0
        
        # Check if hashes are the same type (both perceptual or both SHA256)
        # Perceptual hashes are 16 chars, SHA256 truncated are also 16 chars
        # But perceptual hashes are hex representations of 64-bit values
        
        # Try perceptual hash comparison (for image favicons)
        try:
            # Both should be valid imagehash strings
            h1 = imagehash.hex_to_hash(hash1)
            h2 = imagehash.hex_to_hash(hash2)
            # Hamming distance: 0 = identical, 64 = completely different
            hamming_dist = (h1 - h2)
            similarity = 1.0 - (hamming_dist / 64.0)
            return max(0.0, min(1.0, similarity))
        except (ValueError, TypeError):
            # Not valid imagehash format - probably SHA256 hashes
            # Fall back to string comparison
            if hash1 == hash2:
                return 1.0
            else:
                # Different SHA256 hashes = completely different content
                return 0.0
    except Exception:
        # Unexpected error - return 0.0 (different) rather than NaN
        return 0.0


def _capture_screenshot_wayback(domain: str) -> bytes:
    """Try to fetch archived screenshot from Wayback Machine (Internet Archive).
    
    Returns:
        bytes: PNG screenshot data from archive
        None: If no archived snapshot found
    """
    if not domain or not ENABLE_WAYBACK_FALLBACK:
        return None
    
    try:
        # Query Wayback Machine API for latest snapshot
        availability_url = f'http://archive.org/wayback/available?url={domain}'
        response = requests.get(availability_url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            archived_snapshots = data.get('archived_snapshots', {})
            closest = archived_snapshots.get('closest', {})
            
            if closest and closest.get('available'):
                archived_url = closest.get('url')
                if archived_url:
                    # Try to capture screenshot of archived page using Selenium
                    driver = None
                    try:
                        from selenium import webdriver
                        from selenium.webdriver.chrome.options import Options
                        
                        chrome_options = Options()
                        chrome_options.add_argument('--headless')
                        chrome_options.add_argument('--no-sandbox')
                        chrome_options.add_argument('--disable-dev-shm-usage')
                        chrome_options.add_argument('--disable-gpu')
                        chrome_options.add_argument('--window-size=1280,720')
                        
                        driver = webdriver.Chrome(options=chrome_options)
                        driver.set_page_load_timeout(20)
                        driver.get(archived_url)
                        time.sleep(1.5)  # Wait for archived page to load
                        
                        screenshot_bytes = driver.get_screenshot_as_png()
                        if screenshot_bytes and len(screenshot_bytes) > 1000:
                            return screenshot_bytes
                    except Exception:
                        pass
                    finally:
                        if driver:
                            try:
                                driver.quit()
                            except:
                                pass
    except Exception:
        pass
    
    return None


@lru_cache(maxsize=2048)
def _capture_screenshot_selenium(domain: str) -> bytes:
    """Capture screenshot using Selenium headless Chrome with enhanced retry logic.
    
    Returns:
        bytes: PNG screenshot data
        None: If screenshot capture fails after all attempts
    """
    if not domain:
        return None
    
    # Try with multiple URL variations
    url_variations = [
        f'https://{domain}/',
        f'http://{domain}/',
        f'https://www.{domain}/',
        f'http://www.{domain}/',
    ]
    
    for retry_attempt in range(SCREENSHOT_MAX_RETRIES + 1):
        driver = None
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.chrome.service import Service
            from selenium.common.exceptions import TimeoutException, WebDriverException
            
            # Configure Chrome options for headless mode
            chrome_options = Options()
            chrome_options.add_argument('--headless')  # Run in background
            chrome_options.add_argument('--no-sandbox')  # Required for some systems
            chrome_options.add_argument('--disable-dev-shm-usage')  # Overcome limited resource problems
            chrome_options.add_argument('--disable-gpu')  # Disable GPU acceleration
            chrome_options.add_argument('--window-size=1280,720')  # Set viewport size
            chrome_options.add_argument('--disable-blink-features=AutomationControlled')  # Avoid detection
            chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
            chrome_options.add_argument('--ignore-certificate-errors')  # Ignore SSL errors
            chrome_options.add_argument('--disable-extensions')
            chrome_options.add_argument('--disable-logging')
            chrome_options.add_argument('--log-level=3')  # Suppress console output
            
            # Initialize Chrome driver
            driver = webdriver.Chrome(options=chrome_options)
            driver.set_page_load_timeout(TIMEOUT_SCREENSHOT)
            
            # Try each URL variation
            for url in url_variations:
                try:
                    driver.get(url)
                    # Wait longer for page to fully render
                    time.sleep(1.0)
                    # Capture screenshot as PNG bytes
                    screenshot_bytes = driver.get_screenshot_as_png()
                    # Verify it's valid (non-empty and reasonable size)
                    if screenshot_bytes and len(screenshot_bytes) > 1000:
                        return screenshot_bytes
                except TimeoutException:
                    continue
                except WebDriverException:
                    continue
                except Exception:
                    continue
            
            # All URL variations failed for this attempt
            if driver:
                driver.quit()
                driver = None
            
            # If not last retry, wait before next attempt
            if retry_attempt < SCREENSHOT_MAX_RETRIES:
                time.sleep(SCREENSHOT_RETRY_DELAY)
            
        except ImportError:
            # Selenium not installed
            return None
        except Exception:
            # Unexpected error
            if driver:
                try:
                    driver.quit()
                except:
                    pass
            if retry_attempt < SCREENSHOT_MAX_RETRIES:
                time.sleep(SCREENSHOT_RETRY_DELAY)
            continue
        finally:
            if driver is not None:
                try:
                    driver.quit()
                except:
                    pass
    
    # All live attempts failed - try Wayback Machine as fallback
    if ENABLE_WAYBACK_FALLBACK:
        return _capture_screenshot_wayback(domain)
    
    return None


def _compute_mse_similarity(arr1: np.ndarray, arr2: np.ndarray) -> float:
    """Compute similarity using Mean Squared Error (MSE).
    
    Lower MSE = more similar. Converts to 0-1 scale where 1 = identical.
    """
    mse = np.mean((arr1.astype(float) - arr2.astype(float)) ** 2)
    # Normalize: max MSE for 8-bit images is 255^2 = 65025
    # Convert to similarity: 1.0 - (mse / max_mse)
    max_mse = 255.0 ** 2
    similarity = 1.0 - min(mse / max_mse, 1.0)
    return similarity


def _compute_histogram_similarity(img1: Image.Image, img2: Image.Image) -> float:
    """Compute similarity using histogram correlation."""
    # Get histograms for each channel
    hist1_r = np.array(img1.split()[0].histogram())
    hist1_g = np.array(img1.split()[1].histogram())
    hist1_b = np.array(img1.split()[2].histogram())
    
    hist2_r = np.array(img2.split()[0].histogram())
    hist2_g = np.array(img2.split()[1].histogram())
    hist2_b = np.array(img2.split()[2].histogram())
    
    # Normalize histograms
    hist1_r = hist1_r / hist1_r.sum()
    hist1_g = hist1_g / hist1_g.sum()
    hist1_b = hist1_b / hist1_b.sum()
    
    hist2_r = hist2_r / hist2_r.sum()
    hist2_g = hist2_g / hist2_g.sum()
    hist2_b = hist2_b / hist2_b.sum()
    
    # Compute correlation for each channel
    corr_r = np.corrcoef(hist1_r, hist2_r)[0, 1]
    corr_g = np.corrcoef(hist1_g, hist2_g)[0, 1]
    corr_b = np.corrcoef(hist1_b, hist2_b)[0, 1]
    
    # Average correlation across channels
    avg_corr = (corr_r + corr_g + corr_b) / 3.0
    
    # Convert correlation (-1 to 1) to similarity (0 to 1)
    similarity = (avg_corr + 1.0) / 2.0
    return similarity


def _compute_domain_name_similarity(domain1: str, domain2: str) -> float:
    """Compute similarity between domain names using string metrics.
    
    Used as fallback when visual comparison isn't possible (offline domains).
    Combines multiple string similarity metrics.
    """
    if not domain1 or not domain2:
        return 0.0
    
    # Normalize domains (remove www, convert to lowercase)
    d1 = domain1.lower().replace('www.', '')
    d2 = domain2.lower().replace('www.', '')
    
    # Extract main domain part (before TLD)
    d1_main = d1.split('.')[0] if '.' in d1 else d1
    d2_main = d2.split('.')[0] if '.' in d2 else d2
    
    # Metric 1: Levenshtein similarity (normalized)
    max_len = max(len(d1_main), len(d2_main))
    if max_len == 0:
        lev_similarity = 1.0
    else:
        lev_distance = edit_distance(d1_main, d2_main)
        lev_similarity = 1.0 - (lev_distance / max_len)
    
    # Metric 2: Longest common substring ratio
    def longest_common_substring_length(s1, s2):
        m, n = len(s1), len(s2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        max_len = 0
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if s1[i-1] == s2[j-1]:
                    dp[i][j] = dp[i-1][j-1] + 1
                    max_len = max(max_len, dp[i][j])
        return max_len
    
    lcs_len = longest_common_substring_length(d1_main, d2_main)
    lcs_similarity = lcs_len / max_len if max_len > 0 else 0.0
    
    # Metric 3: Character overlap (Jaccard similarity)
    set1 = set(d1_main)
    set2 = set(d2_main)
    if not set1 and not set2:
        jaccard = 1.0
    elif not set1 or not set2:
        jaccard = 0.0
    else:
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        jaccard = intersection / union
    
    # Combined score: weighted average
    # Levenshtein (50%), LCS (30%), Jaccard (20%)
    combined_score = 0.5 * lev_similarity + 0.3 * lcs_similarity + 0.2 * jaccard
    
    # Scale to 0.0-0.5 range (domain name similarity is less reliable than visual)
    # This ensures it's always lower than actual visual similarity scores
    scaled_score = combined_score * 0.5
    
    return max(0.0, min(0.5, scaled_score))


def compute_ssim_similarity(domain1: str, domain2: str) -> float:
    """Compute visual similarity between screenshots of two domains.
    
    Uses Selenium headless Chrome to capture real screenshots and computes visual similarity
    using a combination of MSE (pixel-wise) and histogram correlation methods.
    
    Requirements:
        - selenium library: pip install selenium
        - Chrome browser and ChromeDriver installed
    
    Returns:
        float: Similarity score 0.0-1.0 (0 = completely different, 1 = identical)
        NaN: If screenshot capture fails or ENABLE_SCREENSHOT_FETCH=False
    
    Note: Screenshot fetching is slow (~5-15 seconds per domain pair). 
          Set ENABLE_SCREENSHOT_FETCH=False to skip and speed up processing.
    """
    # Skip if screenshot fetching is disabled
    if not ENABLE_SCREENSHOT_FETCH:
        return float('nan')
    
    if not domain1 or not domain2:
        return float('nan')
    
    try:
        # Capture screenshots using Selenium
        screenshot1_bytes = _capture_screenshot_selenium(domain1)
        screenshot2_bytes = _capture_screenshot_selenium(domain2)
        
        # If either screenshot failed, try domain name similarity fallback
        if screenshot1_bytes is None or screenshot2_bytes is None:
            if USE_DOMAIN_SIMILARITY_FALLBACK:
                # Use domain name similarity as fallback (scaled to 0-0.5 range)
                return _compute_domain_name_similarity(domain1, domain2)
            else:
                return float('nan')
        
        # Convert bytes to PIL Images
        img1 = Image.open(BytesIO(screenshot1_bytes)).convert('RGB')
        img2 = Image.open(BytesIO(screenshot2_bytes)).convert('RGB')
        
        # Resize both images to same size for comparison
        size = (256, 256)
        img1_resized = img1.resize(size, Image.LANCZOS if hasattr(Image, 'LANCZOS') else Image.Resampling.LANCZOS)
        img2_resized = img2.resize(size, Image.LANCZOS if hasattr(Image, 'LANCZOS') else Image.Resampling.LANCZOS)
        
        # Convert to numpy arrays for MSE computation
        arr1 = np.array(img1_resized)
        arr2 = np.array(img2_resized)
        
        # Compute MSE-based similarity
        mse_similarity = _compute_mse_similarity(arr1, arr2)
        
        # Compute histogram-based similarity  
        hist_similarity = _compute_histogram_similarity(img1_resized, img2_resized)
        
        # Combined score: 70% MSE (structural) + 30% histogram (color distribution)
        combined_score = 0.7 * mse_similarity + 0.3 * hist_similarity
        
        # Ensure score is in valid range [0.0, 1.0]
        return max(0.0, min(1.0, float(combined_score)))
        
    except Exception as e:
        # Any error during similarity computation
        return float('nan')


def _format_brand_position(brand_pos: int, host: str) -> str:
    """Convert brand position to categorical text."""
    if brand_pos == -1:
        return 'none'
    
    # Check if brand is in subdomain (before first dot after www removal)
    clean_host = host[4:] if host.startswith('www.') else host
    labels = clean_host.split('.')
    
    if len(labels) >= 2:
        # Get position in the full host
        first_label_end = len(labels[0])
        if brand_pos < first_label_end:
            return 'subdomain'
        else:
            return 'root_domain'
    return 'root_domain'


# Expected feature columns for XGBoost model
# ============================================================================
# EXPECTED INPUT SCHEMA FOR XGBOOST PHISHING MODEL
# ============================================================================
# This schema defines the exact features, data types, and value ranges expected
# by the trained XGBoost phishing detection model.
#
# Feature Name                    | Data Type      | Value Range / Description
# ============================================================================
# url_length                      | int/float      | 0 to ~2000 (URL character count)
# domain_length                   | int/float      | 1 to ~255 (domain character count)
# path_length                     | int/float      | 0 to ~2000 (URL path character count)
# num_subdomains                  | int/float      | 0 to ~10+ (subdomain count)
# num_dots                        | int/float      | 0 to ~10+ (dot count in domain)
# domain_num_hyphens              | int/float      | 0 to ~20+ (hyphen count in domain)
# num_special_chars               | int/float      | 0 to ~100+ (special character count)
# ip_address                      | str            | IPv4 format (e.g., "192.168.1.1") or empty string ""
# url_entropy                     | float          | 0.0 to ~7.0 (Shannon entropy of URL)
# is_idn                          | int/float      | 0 or 1 (binary: IDN domain indicator)
# typosquatting_score             | str            | 'Low', 'Medium', 'High', or NaN
# brand_word_present              | int/float      | 0 or 1 (binary: brand keyword present)
# misleading_keyword_present      | int/float      | 0 or 1 (binary: misleading keyword present)
# brand_position                  | str            | 'none', 'subdomain', 'root_domain', or NaN
# domain_age_days                 | float          | 0 to ~20000+ (days since domain creation) or NaN
# HTTPS                           | str            | 'True' or 'False' (categorical)
# Is_Tunneling                    | int/float      | 0 or 1 (binary: URL shortener/tunneling)
# ttl_avg                         | float          | 0 to ~86400+ (DNS TTL in seconds) or NaN
# ssim_score                      | float          | 0.0 to 1.0 (SSIM similarity score) or NaN
# favicon_similarity_score        | float          | 0.0 to 1.0 (favicon similarity) or NaN
# asn_number                      | int/float      | Positive integer (ASN) or NaN
# reverse_dns_entropy             | float          | 0.0 to ~7.0 (reverse DNS entropy) or NaN
# ============================================================================
# Notes:
# - NaN values are acceptable for network-derived features that may fail
# - All numeric fields should be float or int type
# - Categorical fields (HTTPS, typosquatting_score, brand_position) must be strings
# - ip_address should be either a valid IPv4 string or empty string ""
# - Boolean values should be converted to 'True'/'False' strings
# ============================================================================

EXPECTED_FEATURES = [
    'url_length', 'domain_length', 'path_length', 'num_subdomains', 'num_dots',
    'domain_num_hyphens', 'num_special_chars', 'ip_address', 'url_entropy',
    'is_idn', 'typosquatting_score', 'brand_word_present', 'misleading_keyword_present',
    'brand_position', 'domain_age_days', 'HTTPS', 'Is_Tunneling', 'ttl_avg',
    'ssim_score', 'favicon_similarity_score', 'asn_number', 'reverse_dns_entropy'
]


def validate_feature_order(features: dict) -> dict:
    """Validate and reorder features to match XGBoost model's expected format.
    
    Allows extra metadata fields (like domain_exists) to pass through.
    """
    # Check for missing features
    missing_features = set(EXPECTED_FEATURES) - set(features.keys())
    if missing_features:
        raise ValueError(f"Missing features: {missing_features}")
    
    # Check for extra features (excluding known metadata fields)
    METADATA_FIELDS = {'domain_exists'}  # Known metadata fields that are allowed
    extra_features = set(features.keys()) - set(EXPECTED_FEATURES) - METADATA_FIELDS
    if extra_features:
        raise ValueError(f"Extra features not expected by model: {extra_features}")
    
    # Reorder expected features, then append metadata fields
    ordered_features = {key: features[key] for key in EXPECTED_FEATURES}
    
    # Add metadata fields if present
    for metadata_field in METADATA_FIELDS:
        if metadata_field in features:
            ordered_features[metadata_field] = features[metadata_field]
    
    return ordered_features


def prepare_model_input(features: dict, verbose: bool = False) -> dict:
    """
    Wrapper function that applies all necessary transformations to raw features
    to match the XGBoost model's expected input format.
    
    This applies the EXACT same preprocessing pipeline used during model training:
    1. Validate feature presence and order
    2. Convert HTTPS boolean to categorical string
    3. Ordinal encode typosquatting_score (Low→1, Medium→2, High→3)
    4. One-hot encode brand_position (creates brand_position_subdomain, brand_position_root_domain)
    5. One-hot encode HTTPS (creates HTTPS_Yes - matches training pipeline)
    6. Handle NaN values consistently
    7. Ensure numeric fields are proper types
    8. Return only the 22 features expected by the model (excluding ip_address)
    
    Args:
        features: Raw feature dictionary from feature_row_from_url()
        verbose: If True, print transformation details
    
    Returns:
        Transformed feature dictionary ready for model input (22 features, matches training pipeline)
    """
    # Validate and reorder features
    features = validate_feature_order(features)
    
    if verbose:
        print("\n[Model Input Preparation - Matching Training Pipeline]")
    
    # Step 1: Convert HTTPS boolean to categorical string
    if isinstance(features['HTTPS'], bool):
        features['HTTPS'] = 'Yes' if features['HTTPS'] else 'No'
        if verbose:
            print(f"  HTTPS: Converted boolean to categorical string '{features['HTTPS']}'")
    
    # Step 2: Ordinal encode typosquatting_score: Low → 1, Medium → 2, High → 3
    typosquatting_mapping = {'Low': 1, 'Medium': 2, 'High': 3}
    if features['typosquatting_score'] in typosquatting_mapping:
        features['typosquatting_score_encoded'] = typosquatting_mapping[features['typosquatting_score']]
        if verbose:
            print(f"  typosquatting_score: Ordinal encoded to {features['typosquatting_score_encoded']}")
    elif isinstance(features['typosquatting_score'], float) and np.isnan(features['typosquatting_score']):
        features['typosquatting_score_encoded'] = np.nan
        if verbose:
            print(f"  typosquatting_score: NaN value retained")
    else:
        features['typosquatting_score_encoded'] = np.nan
        if verbose:
            print(f"  Warning: typosquatting_score '{features['typosquatting_score']}' not recognized, set to NaN")
    
    # Step 3: One-hot encode brand_position (drop_first=True means 'none' is the reference)
    # Creates: brand_position_subdomain (0 or 1), brand_position_root_domain (0 or 1)
    brand_pos = features['brand_position']
    features['brand_position_subdomain'] = 1 if brand_pos == 'subdomain' else 0
    features['brand_position_root_domain'] = 1 if brand_pos == 'root_domain' else 0
    if verbose:
        print(f"  brand_position: One-hot encoded")
        print(f"    brand_position_subdomain: {features['brand_position_subdomain']}")
        print(f"    brand_position_root_domain: {features['brand_position_root_domain']}")
    
    # Step 4: One-hot encode HTTPS (drop_first=True means 'No' is the reference)
    # Creates: HTTPS_Yes (0 or 1) - matches training pipeline
    https_val = features['HTTPS']
    features['HTTPS_Yes'] = 1 if https_val == 'Yes' else 0
    if verbose:
        print(f"  HTTPS: One-hot encoded")
        print(f"    HTTPS_Yes: {features['HTTPS_Yes']}")
    
    # Step 5: Ensure numeric fields are proper types
    numeric_fields = [
        'url_length', 'domain_length', 'path_length', 'num_subdomains', 'num_dots',
        'domain_num_hyphens', 'num_special_chars', 'url_entropy', 'is_idn',
        'brand_word_present', 'misleading_keyword_present', 'domain_age_days',
        'Is_Tunneling', 'ttl_avg', 'ssim_score', 'favicon_similarity_score',
        'asn_number', 'reverse_dns_entropy', 'typosquatting_score_encoded',
        'brand_position_subdomain', 'brand_position_root_domain', 'HTTPS_Yes'
    ]
    
    for field in numeric_fields:
        if field in features:
            val = features[field]
            # Convert to float if not already NaN
            if not (isinstance(val, float) and np.isnan(val)):
                try:
                    features[field] = float(val)
                except (ValueError, TypeError):
                    features[field] = np.nan
                    if verbose:
                        print(f"  {field}: Could not convert to float, set to NaN")
    
    # Step 6: Return only the 22 features expected by the model + metadata columns
    # NOTE: ip_address is NOT included (model was trained without it)
    # Feature order must match exactly: model.feature_names_in_
    features_for_model = {
        'url_length': features['url_length'],
        'domain_length': features['domain_length'],
        'path_length': features['path_length'],
        'num_subdomains': features['num_subdomains'],
        'num_dots': features['num_dots'],
        'domain_num_hyphens': features['domain_num_hyphens'],
        'num_special_chars': features['num_special_chars'],
        'url_entropy': features['url_entropy'],
        'is_idn': features['is_idn'],
        'brand_word_present': features['brand_word_present'],
        'misleading_keyword_present': features['misleading_keyword_present'],
        'domain_age_days': features['domain_age_days'],
        'Is_Tunneling': features['Is_Tunneling'],
        'ttl_avg': features['ttl_avg'],
        'ssim_score': features['ssim_score'],
        'favicon_similarity_score': features['favicon_similarity_score'],
        'asn_number': features['asn_number'],
        'reverse_dns_entropy': features['reverse_dns_entropy'],
        'typosquatting_score': features['typosquatting_score'],
        'brand_position': features['brand_position'],
        'HTTPS': features['HTTPS'],
        'typosquatting_score_encoded': features['typosquatting_score_encoded'],
        'brand_position_root_domain': features['brand_position_root_domain'],
        'brand_position_subdomain': features['brand_position_subdomain'],
        'HTTPS_Yes': features['HTTPS_Yes'],
        'domain_exists': features.get('domain_exists', np.nan),  # Metadata column
    }
    
    if verbose:
        print("  ✓ All transformations completed successfully")
        print(f"  ✓ Output features (22 model features + 1 metadata): {list(features_for_model.keys())}")
    
    return features_for_model


def generate_model_features(
    url: str,
    scraped_data: Optional[Dict[str, Any]] = None,
    legitimate_domain: Optional[str] = None,
    verbose: bool = False,
) -> Dict[str, Any]:
    """Produce model-ready features for the given URL.

    This function wraps :func:`feature_row_from_url` to generate the raw feature set,
    then applies any overrides from previously scraped data before translating the
    result into the exact schema required by the model via :func:`prepare_model_input`.

    Args:
        url: Target URL to analyse.
        scraped_data: Optional dictionary containing previously collected signals such
            as DNS, WHOIS, ASN, reverse DNS, SSIM score, and favicon similarity.
        legitimate_domain: Optional legitimate domain used for similarity checks.
        verbose: Emit detailed logging when True.

    Returns:
        Dictionary containing the 22 model features (plus metadata columns) aligned
        with the training pipeline expectations.
    """

    raw_features = feature_row_from_url(
        url,
        verbose=verbose,
        legitimate_domain=legitimate_domain,
    )

    if scraped_data:
        dns_data = scraped_data.get("dns")
        if dns_data:
            if isinstance(dns_data, dict):
                ttl_value = dns_data.get("ttl_avg")
                if ttl_value is not None:
                    try:
                        raw_features["ttl_avg"] = float(ttl_value)
                    except (TypeError, ValueError):
                        pass

                a_records = dns_data.get("a_records") or []
                if isinstance(a_records, list) and a_records:
                    raw_features["domain_exists"] = True
                    first_ip = next((record for record in a_records if record), None)
                    if first_ip:
                        raw_features["ip_address"] = first_ip
            else:
                ttl_value = getattr(dns_data, "ttl_avg", None)
                if ttl_value is not None:
                    try:
                        raw_features["ttl_avg"] = float(ttl_value)
                    except (TypeError, ValueError):
                        pass

                a_records = getattr(dns_data, "a_records", None) or []
                if a_records:
                    raw_features["domain_exists"] = True
                    first_ip = next((record for record in a_records if record), None)
                    if first_ip:
                        raw_features["ip_address"] = first_ip

        whois_data = scraped_data.get("whois")
        creation_source = None
        if isinstance(whois_data, dict):
            creation_source = whois_data.get("creation_date")
        elif whois_data is not None:
            creation_source = getattr(whois_data, "creation_date", None)

        if creation_source:
            creation_dt = None
            if isinstance(creation_source, datetime):
                creation_dt = creation_source
            elif isinstance(creation_source, str):
                try:
                    creation_dt = datetime.fromisoformat(creation_source.replace("Z", "+00:00"))
                except ValueError:
                    creation_dt = None

            if creation_dt:
                if creation_dt.tzinfo is None:
                    creation_dt = creation_dt.replace(tzinfo=timezone.utc)
                age_days = max(0.0, (datetime.now(timezone.utc) - creation_dt).days)
                raw_features["domain_age_days"] = float(age_days)

        asn_value = scraped_data.get("asn")
        if asn_value is not None:
            try:
                raw_features["asn_number"] = float(asn_value)
            except (TypeError, ValueError):
                pass

        reverse_dns_value = scraped_data.get("reverse_dns")
        if reverse_dns_value:
            raw_features["reverse_dns_entropy"] = shannon_entropy(str(reverse_dns_value))

        ssim_value = scraped_data.get("ssim_score")
        if ssim_value is not None:
            try:
                raw_features["ssim_score"] = float(ssim_value)
            except (TypeError, ValueError):
                pass

        favicon_value = (
            scraped_data.get("favicon_similarity")
            if "favicon_similarity" in scraped_data
            else scraped_data.get("favicon_similarity_score")
        )
        if favicon_value is not None:
            try:
                raw_features["favicon_similarity_score"] = float(favicon_value)
            except (TypeError, ValueError):
                pass

    model_features = prepare_model_input(raw_features, verbose=verbose)
    return model_features


def feature_row_from_url(url: str, verbose: bool = True, legitimate_domain: str = None) -> dict:
    if verbose:
        print(f"\n{'='*80}")
        print(f"Processing URL: {url}")
        print(f"{'='*80}")
    
    try:
        parsed = urlparse(url if re.match(r'^\w+://', str(url)) else f"http://{url}")
    except Exception:
        parsed = urlparse('')

    full = parsed.geturl() or (url or '')
    host = (parsed.hostname or '').lower()
    path = parsed.path or ''

    if verbose:
        print(f"  Parsed URL: {full}")
        print(f"  Host: {host}")
        print(f"  Path: {path}")

    # Basic string-based metrics
    url_len = int(len(full))
    dom = host
    dom_len = int(len(dom))
    path_len = int(len(path))
    sub_count = int(count_subdomains(dom))
    dot_count = int(num_dots(dom))
    hyphen_count = int(num_hyphens_domain(dom))
    special_count = int(num_special_characters(full))
    has_ip = dom if is_ipv4(dom) else ''
    entropy = float(shannon_entropy(full))
    idn_flag = int(is_idn_domain(dom))

    if verbose:
        print(f"\n  [String Metrics]")
        print(f"    url_length: {url_len}")
        print(f"    domain_length: {dom_len}")
        print(f"    path_length: {path_len}")
        print(f"    num_subdomains: {sub_count}")
        print(f"    num_dots: {dot_count}")
        print(f"    domain_num_hyphens: {hyphen_count}")
        print(f"    num_special_chars: {special_count}")
        print(f"    ip_address: {has_ip}")
        print(f"    url_entropy: {entropy:.6f}")
        print(f"    is_idn: {idn_flag}")

    # Brand-related
    dom_core = extract_domain(dom)
    brand_present = 0
    brand_pos = -1
    edit_min = None
    for b in DEFAULT_BRANDS:
        pos = dom.find(b)
        if pos != -1:
            brand_present = 1
            if brand_pos == -1 or pos < brand_pos:
                brand_pos = pos
        d = edit_distance(dom_core, b)
        edit_min = d if edit_min is None else min(edit_min, d)
    if edit_min is None:
        edit_min = 0

    # Calculate typosquatting score
    typosquatting_score = _calculate_typosquatting_score(edit_min)
    
    # Format brand position
    brand_position_text = _format_brand_position(brand_pos, dom)

    misleading_present = int(1 if any(k in full.lower() for k in MISLEADING_KEYWORDS) else 0)

    # Heuristics for tunneling/shortening
    is_tunneling = int(1 if dom in SHORTENER_DOMAINS else 0)

    # HTTPS presence from scheme
    https_flag = True if parsed.scheme.lower() == 'https' else False

    if verbose:
        print(f"\n  [Brand & Security Metrics]")
        print(f"    brand_word_present: {brand_present}")
        print(f"    typosquatting_score: {typosquatting_score}")
        print(f"    brand_position: {brand_position_text}")
        print(f"    misleading_keyword_present: {misleading_present}")
        print(f"    Is_Tunneling: {is_tunneling}")
        print(f"    HTTPS: {https_flag}")

    # Network-derived features with caching and robust fallbacks
    if verbose:
        print(f"\n  [Fetching Network Data]")
    
    # Check if domain exists (DNS resolution)
    domain_ips = resolve_a_records(dom)
    domain_exists = bool(domain_ips)  # True if DNS resolves, False otherwise
    if verbose:
        print(f"    domain_exists: {domain_exists}")
    
    domain_age_days = get_domain_age_days(dom)
    if verbose:
        print(f"    domain_age_days: {domain_age_days}")
    
    ttl_avg = get_dns_ttl_avg(dom)
    if verbose:
        print(f"    ttl_avg: {ttl_avg}")
    
    asn_number, country_code = get_asn_and_country(dom)
    if verbose:
        print(f"    asn_number: {asn_number}, country_code: {country_code}")
    
    reverse_dns_entropy = get_reverse_dns_entropy(dom)
    if verbose:
        print(f"    reverse_dns_entropy: {reverse_dns_entropy}")

    # HTTPS presence: if scheme missing, probe HTTPS quickly
    if not https_flag and dom:
        if supports_https(dom):
            https_flag = True
            if verbose:
                print(f"    HTTPS Support: Yes (detected)")
        elif verbose:
            print(f"    HTTPS Support: No")

    # Favicon: fetch and hash
    favicon_hash = fetch_favicon_hash(dom)
    if verbose:
        print(f"    favicon_hash: {favicon_hash if favicon_hash else 'Not found'}")

    # Compute similarity scores if legitimate domain is provided
    if legitimate_domain:
        favicon_similarity_score = compute_favicon_similarity(dom, legitimate_domain)
        ssim_score = compute_ssim_similarity(dom, legitimate_domain)
        if verbose:
            print(f"    favicon_similarity_score: {favicon_similarity_score}")
            print(f"    ssim_score: {ssim_score}")
    else:
        favicon_similarity_score = float('nan')
        ssim_score = float('nan')
    
    # Convert asn_number to int if valid
    if isinstance(asn_number, float) and not math.isnan(asn_number):
        asn_number = int(asn_number)

    result = {
        'url_length': url_len,
        'domain_length': dom_len,
        'path_length': path_len,
        'num_subdomains': sub_count,
        'num_dots': dot_count,
        'domain_num_hyphens': hyphen_count,
        'num_special_chars': special_count,
        'ip_address': has_ip,
        'url_entropy': entropy,
        'is_idn': idn_flag,
        'typosquatting_score': typosquatting_score,
        'brand_word_present': brand_present,
        'misleading_keyword_present': misleading_present,
        'brand_position': brand_position_text,
        'domain_age_days': domain_age_days,
        'HTTPS': https_flag,
        'Is_Tunneling': is_tunneling,
        'ttl_avg': ttl_avg,
        'ssim_score': ssim_score,
        'favicon_similarity_score': favicon_similarity_score,
        'asn_number': asn_number,
        'reverse_dns_entropy': reverse_dns_entropy,
        'domain_exists': domain_exists,
    }

    if verbose:
        print(f"\n  [Final Features Summary]")
        for key, value in result.items():
            print(f"    {key}: {value}")

    # Validate and reorder features
    try:
        result = validate_feature_order(result)
    except ValueError as e:
        print(f"\n✗ Feature validation error: {e}")
        raise

    return result


def print_features_only(features: dict) -> None:
    """Display only the 22 features and their values."""
    feature_order = [
        'url_length', 'domain_length', 'path_length', 'num_subdomains', 'num_dots',
        'domain_num_hyphens', 'num_special_chars', 'url_entropy', 'is_idn',
        'brand_word_present', 'misleading_keyword_present', 'domain_age_days',
        'Is_Tunneling', 'ttl_avg', 'ssim_score', 'favicon_similarity_score',
        'asn_number', 'reverse_dns_entropy', 'typosquatting_score_encoded',
        'brand_position_root_domain', 'brand_position_subdomain', 'HTTPS_Yes'
    ]
    
    for feature in feature_order:
        value = features.get(feature, np.nan)
        print(f"{feature}: {value}")




def main(input_excel: str = 'filtered_jalalu.xlsx', domain_column: str = 'Domain', legitimate_column: str = 'Corresponding CSE Domain Name', output_excel: str = 'filtered_jalalu_enriched.xlsx') -> None:
    try:
        df = pd.read_excel(input_excel)
    except Exception as e:
        print(f"Error: Failed to read '{input_excel}': {e}")
        sys.exit(1)

    if domain_column not in df.columns:
        print(f"Error: Column '{domain_column}' not found in {input_excel}")
        sys.exit(1)

    has_legitimate_column = legitimate_column in df.columns
    
    features = []
    
    for idx, row in df.iterrows():
        url = str(row[domain_column]).strip() if pd.notna(row[domain_column]) else ''
        legitimate_domain = None
        
        if has_legitimate_column:
            legit_val = row[legitimate_column]
            if pd.notna(legit_val):
                legitimate_domain = str(legit_val).strip()
        
        # If no legitimate domain provided, find best matching from LEGITIMATE_DOMAINS
        if not legitimate_domain and url:
            legitimate_domain = find_best_matching_legitimate_domain(url)
        
        try:
            raw_features = feature_row_from_url(url, verbose=False, legitimate_domain=legitimate_domain)
            encoded_features = prepare_model_input(raw_features, verbose=False)
            features.append(encoded_features)
            
            # Print only the 22 features for this URL
            print(f"\n--- URL {idx+1}/{len(df)}: {url} ---")
            print_features_only(encoded_features)
            
        except Exception as e:
            # On error, print error message and skip
            print(f"\nError processing URL {idx+1}/{len(df)}: {url}")
            print(f"Details: {e}")
            # Add a row with NaN values for this URL (matching 22-feature encoded structure + domain_exists)
            features.append({
                'url_length': np.nan,
                'domain_length': np.nan,
                'path_length': np.nan,
                'num_subdomains': np.nan,
                'num_dots': np.nan,
                'domain_num_hyphens': np.nan,
                'num_special_chars': np.nan,
                'url_entropy': np.nan,
                'is_idn': np.nan,
                'brand_word_present': np.nan,
                'misleading_keyword_present': np.nan,
                'domain_age_days': np.nan,
                'Is_Tunneling': np.nan,
                'ttl_avg': np.nan,
                'ssim_score': np.nan,
                'favicon_similarity_score': np.nan,
                'asn_number': np.nan,
                'reverse_dns_entropy': np.nan,
                'typosquatting_score_encoded': np.nan,
                'brand_position_root_domain': np.nan,
                'brand_position_subdomain': np.nan,
                'HTTPS_Yes': np.nan,
                'domain_exists': np.nan,
            })

    feat_df = pd.DataFrame(features)

    # Include ALL input columns and fetched features
    # This preserves any additional columns (labels, metadata, etc.) from the input file
    out_df = pd.concat([
        df.reset_index(drop=True),
        feat_df.reset_index(drop=True)
    ], axis=1)

    try:
        out_df.to_excel(output_excel, index=False)
    except Exception as e:
        print(f"Error: Failed to write '{output_excel}': {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()


