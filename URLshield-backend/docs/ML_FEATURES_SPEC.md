# ML Model Feature Specification

## Overview
This document specifies the exact features required by the XGBoost phishing detection model, including data types, encodings, and transformations.

## Required Features (23 total)

### 1. URL Structure Features (8 features)

| Feature | Type | Description | Example |
|---------|------|-------------|---------|
| `url_length` | int/float | Total length of URL in characters | 45 |
| `domain_length` | int/float | Length of domain name | 15 |
| `path_length` | int/float | Length of URL path | 12 |
| `num_subdomains` | int/float | Number of subdomains | 2 |
| `num_dots` | int/float | Number of dots in URL | 3 |
| `domain_num_hyphens` | int/float | Number of hyphens in domain | 1 |
| `num_special_chars` | int/float | Count of special chars (@#?&=%) | 2 |
| `url_entropy` | float | Shannon entropy of URL | 3.45 |

**Calculation:**
```python
url_length = len(url)
domain_length = len(domain)
path_length = len(parsed.path)
num_subdomains = len(subdomain.split('.')) if subdomain else 0
num_dots = url.count('.')
domain_num_hyphens = domain.count('-')
num_special_chars = len(re.findall(r'[@#?&=%]', url))
url_entropy = calculate_shannon_entropy(url)
```

### 2. Detection Features (6 features)

| Feature | Type | Description | Values |
|---------|------|-------------|--------|
| `is_idn` | 0/1 | Internationalized Domain Name | 0 or 1 |
| `brand_word_present` | 0/1 | Contains brand keyword | 0 or 1 |
| `misleading_keyword_present` | 0/1 | Contains misleading keyword | 0 or 1 |
| `typosquatting_score_encoded` | int | Encoded typosquatting level | 1, 2, or 3 |
| `brand_position_root_domain` | 0/1 | Brand in root domain | 0 or 1 |
| `brand_position_subdomain` | 0/1 | Brand in subdomain | 0 or 1 |

**Encoding:**
- `typosquatting_score_encoded`:
  - `Low` → 1
  - `Medium` → 2
  - `High` → 3

- `brand_position` (categorical) → two binary features:
  - `none` → root_domain=0, subdomain=0
  - `root_domain` → root_domain=1, subdomain=0
  - `subdomain` → root_domain=0, subdomain=1

### 3. Network Features (6 features)

| Feature | Type | Description | Range |
|---------|------|-------------|-------|
| `domain_age_days` | int/float/NaN | Domain age in days | 0-∞ or NaN |
| `HTTPS_Yes` | 0/1 | Uses HTTPS protocol | 0 or 1 |
| `Is_Tunneling` | 0/1 | Uses tunneling/proxy | 0 or 1 |
| `ttl_avg` | float/NaN | Average DNS TTL | 0-∞ or NaN |
| `asn_number` | int/float/NaN | Autonomous System Number | 0-∞ or NaN |
| `reverse_dns_entropy` | float/NaN | Entropy of reverse DNS | 0-∞ or NaN |

**Encoding:**
- `HTTPS` (boolean) → `HTTPS_Yes` (0/1):
  - `False` → 0
  - `True` → 1

**Missing Values:**
- Use `np.nan` for missing numeric features
- Model handles NaN values internally

### 4. Similarity Features (2 features)

| Feature | Type | Description | Range |
|---------|------|-------------|-------|
| `ssim_score` | float/NaN | Structural similarity score | 0.0-1.0 or NaN |
| `favicon_similarity_score` | float/NaN | Favicon similarity score | 0.0-1.0 or NaN |

**Missing Values:**
- Use `np.nan` when similarity cannot be computed
- Occurs when no template/reference exists

## Feature Transformation Pipeline

### Step 1: Generate Model-Ready Features
```python
from yodhac.model_feature_provider import generate_model_features

ml_features = generate_model_features(url, scraped_data)
```

Under the hood `generate_model_features`:
- Extracts the raw URL/domain signals
- Applies the same preprocessing used during training (encoding, numeric casts, NaN handling)
- Returns the 22 features (plus metadata such as `domain_exists`) in the exact order the model expects

### Step 3: Validate Features
```python
from yodhac.ml_feature_prep import validate_model_features

is_valid, missing = validate_model_features(ml_features)
if not is_valid:
    print(f"Missing features: {missing}")
```

### Step 4: Make Prediction
```python
from yodhac.predictor import predict_from_features

prediction = predict_from_features({'ml_features': ml_features})
```

## Complete Feature List (Alphabetical)

```python
required_features = [
    'asn_number',                      # int/float/NaN
    'brand_position_root_domain',      # 0/1
    'brand_position_subdomain',        # 0/1
    'brand_word_present',              # 0/1
    'domain_age_days',                 # int/float/NaN
    'domain_length',                   # int/float
    'domain_num_hyphens',              # int/float
    'favicon_similarity_score',        # float/NaN
    'HTTPS_Yes',                       # 0/1
    'is_idn',                          # 0/1
    'Is_Tunneling',                    # 0/1
    'misleading_keyword_present',      # 0/1
    'num_dots',                        # int/float
    'num_special_chars',               # int/float
    'num_subdomains',                  # int/float
    'path_length',                     # int/float
    'reverse_dns_entropy',             # float/NaN
    'ssim_score',                      # float/NaN
    'ttl_avg',                         # float/NaN
    'typosquatting_score_encoded',     # 1/2/3
    'url_entropy',                     # float
    'url_length',                      # int/float
]
```

## Example Feature Dictionary

```python
{
    # URL Structure
    'url_length': 45,
    'domain_length': 15,
    'path_length': 12,
    'num_subdomains': 2,
    'num_dots': 3,
    'domain_num_hyphens': 1,
    'num_special_chars': 2,
    'url_entropy': 3.45,
    
    # Detection
    'is_idn': 0,
    'brand_word_present': 1,
    'misleading_keyword_present': 0,
    'typosquatting_score_encoded': 2,  # Medium
    'brand_position_root_domain': 1,
    'brand_position_subdomain': 0,
    
    # Network
    'domain_age_days': 365.0,
    'HTTPS_Yes': 1,
    'Is_Tunneling': 0,
    'ttl_avg': 3600.0,
    'asn_number': 15169.0,
    'reverse_dns_entropy': 2.5,
    
    # Similarity
    'ssim_score': 0.85,
    'favicon_similarity_score': 0.92,
}
```

## Data Types Summary

| Type | Features | Notes |
|------|----------|-------|
| **int/float** | url_length, domain_length, path_length, num_subdomains, num_dots, domain_num_hyphens, num_special_chars | Always numeric |
| **float** | url_entropy | Always numeric |
| **0/1 (binary)** | is_idn, brand_word_present, misleading_keyword_present, brand_position_root_domain, brand_position_subdomain, HTTPS_Yes, Is_Tunneling | Binary flags |
| **1/2/3 (ordinal)** | typosquatting_score_encoded | Encoded categorical |
| **float/NaN** | domain_age_days, ttl_avg, ssim_score, favicon_similarity_score, asn_number, reverse_dns_entropy | Can be missing |

## Preprocessing in Model

The model applies additional preprocessing:

### 1. One-Hot Encoding (already done)
- `brand_position` → `brand_position_root_domain`, `brand_position_subdomain`
- `HTTPS` → `HTTPS_Yes`

### 2. Ordinal Encoding (already done)
- `typosquatting_score` → `typosquatting_score_encoded`

### 3. Feature Scaling
Numerical features are scaled using StandardScaler:
- `url_length`, `domain_length`, `path_length`, `num_subdomains`
- `num_dots`, `domain_num_hyphens`, `num_special_chars`, `url_entropy`
- `domain_age_days`, `ttl_avg`, `ssim_score`, `favicon_similarity_score`
- `asn_number`, `reverse_dns_entropy`

**Note:** Scaling is applied by the predictor, not during feature extraction.

## Missing Value Handling

### Features that can be NaN:
- `domain_age_days` - When WHOIS data unavailable
- `ttl_avg` - When DNS query fails
- `ssim_score` - When no template exists
- `favicon_similarity_score` - When no favicon or template
- `asn_number` - When network data unavailable
- `reverse_dns_entropy` - When reverse DNS fails

### Features that must NOT be NaN:
- All URL structure features (always computable)
- All binary detection features (default to 0)
- `typosquatting_score_encoded` (default to 1 = Low)

### Default Values:
```python
defaults = {
    'is_idn': 0,
    'brand_word_present': 0,
    'misleading_keyword_present': 0,
    'Is_Tunneling': 0,
    'HTTPS_Yes': 0,
    'brand_position_root_domain': 0,
    'brand_position_subdomain': 0,
    'typosquatting_score_encoded': 1,
    'domain_age_days': np.nan,
    'ttl_avg': np.nan,
    'ssim_score': np.nan,
    'favicon_similarity_score': np.nan,
    'asn_number': np.nan,
    'reverse_dns_entropy': np.nan,
}
```

## Testing Feature Format

```python
from yodhac.ml_feature_prep import validate_model_features, get_feature_summary

# Validate
is_valid, missing = validate_model_features(ml_features)
print(f"Valid: {is_valid}")
print(f"Missing: {missing}")

# Get summary
summary = get_feature_summary(ml_features)
print(f"URL Structure: {summary['url_structure']}")
print(f"Detection: {summary['detection_features']}")
print(f"Network: {summary['network_features']}")
print(f"Similarity: {summary['similarity_features']}")
```

## Common Issues

### 1. Wrong Feature Names
❌ `HTTPS` → ✅ `HTTPS_Yes`
❌ `typosquatting_score` → ✅ `typosquatting_score_encoded`
❌ `brand_position` → ✅ `brand_position_root_domain` + `brand_position_subdomain`

### 2. Wrong Data Types
❌ `HTTPS_Yes: True` → ✅ `HTTPS_Yes: 1`
❌ `typosquatting_score_encoded: "Medium"` → ✅ `typosquatting_score_encoded: 2`
❌ `domain_age_days: None` → ✅ `domain_age_days: np.nan`

### 3. Missing Features
All 23 features must be present (even if NaN for some).

## Integration

The feature preparation is automatically applied in the pipeline:

```
URL → FeatureExtractor.extract_all_features()
    → prepare_features_for_model()
    → validate_model_features()
    → PhishingModelPredictor.predict()
```

No manual intervention needed - features are automatically transformed to the correct format!

## Summary

✅ **23 required features** in exact format
✅ **Automatic transformation** from raw to model-ready
✅ **Validation** ensures all features present
✅ **NaN handling** for missing network/similarity data
✅ **Type safety** with proper encoding

The `ml_feature_prep.py` module handles all transformations automatically!
