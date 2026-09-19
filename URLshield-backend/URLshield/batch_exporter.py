"""
Batch Result Exporter
Exports batch job results to PS-02 format Excel file
"""

import pandas as pd
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
import json

from URLshield.logger import get_logger
from URLshield.config import Settings
from URLshield.model_feature_provider import find_best_matching_legitimate_domain

logger = get_logger(__name__)


class BatchExporter:
    """Export batch results to PS-02 format Excel"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.batch_storage_dir = settings.data_root / "batch_jobs"
        
    def export_batch_to_ps02(
        self, 
        batch_id: str,
        application_id: str,
        source_of_detection: str = "Automated System",
        cse_domain_name: str = "",
        cse_name: str = "",
        output_path: Optional[Path] = None
    ) -> Path:
        """
        Export batch results to PS-02 format Excel file
        
        Parameters:
        - batch_id: Batch job ID
        - application_id: Application ID for PS-02
        - source_of_detection: Source of detection (default: "Automated System")
        - cse_domain_name: Corresponding CSE Domain Name
        - cse_name: Critical Sector Entity Name
        - output_path: Optional custom output path
        
        Returns:
        - Path to generated Excel file
        """
        logger.info(f"Exporting batch {batch_id} to PS-02 format...")
        
        # Load batch status
        batch_dir = self.batch_storage_dir / batch_id
        status_file = batch_dir / "status.json"
        
        if not status_file.exists():
            raise FileNotFoundError(f"Batch {batch_id} not found")
        
        with open(status_file, 'r') as f:
            batch_status = json.load(f)
        
        # Load URLs
        urls_file = batch_dir / "urls.json"
        with open(urls_file, 'r') as f:
            urls_data = json.load(f)
        
        # Collect all job results
        rows = []
        for job_id in batch_status.get('job_ids', []):
            try:
                job_data = self._load_job_data(job_id)
                if job_data:
                    row = self._create_ps02_row(
                        job_data,
                        application_id,
                        source_of_detection,
                        cse_domain_name,
                        cse_name
                    )
                    rows.append(row)
            except Exception as e:
                logger.warning(f"Failed to load job {job_id}: {e}")
        
        # Create DataFrame
        df = pd.DataFrame(rows, columns=self._get_ps02_columns())
        
        # Generate output path
        if output_path is None:
            timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
            filename = f"PS-02_{application_id}_Submission_Set_{timestamp}.xlsx"
            output_path = batch_dir / filename
        
        # Export to Excel
        df.to_excel(output_path, index=False, engine='openpyxl')
        
        logger.info(f"Exported {len(rows)} results to {output_path}")
        return output_path
    
    def _get_ps02_columns(self) -> List[str]:
        """Get PS-02 required columns"""
        base_columns = [
            "Application_ID",
            "Source of detection",
            "Identified Phishing/Suspected Domain Name",
            "Corresponding CSE Domain Name",
            "Critical Sector Entity Name",
            "Phishing/Suspected Domains (i.e. Class Label)",
            "Domain Registration Date",
            "Registrar Name",
            "Registrant Name or Registrant Organisation",
            "Registrant Country",
            "Name Servers",
            "Hosting IP",
            "Hosting ISP",
            "Hosting Country",
            "DNS Records (if any)",
            "Evidence file name",
            "Date of detection (DD-MM-YYYY)",
            "Time of detection (HH-MM-SS)",
            "Date of Post (If detection is from Source: social media)",
            "Remarks (If any)"
        ]

        feature_columns = [
            "Prediction Confidence (%)",
            "Risk Score (%)",
            "URL Length",
            "Domain Length",
            "Path Length",
            "Subdomain Count",
            "Dot Count",
            "Hyphen Count",
            "Special Character Count",
            "URL Entropy",
            "IDN Domain",
            "Brand Word Present",
            "Misleading Keywords Present",
            "Typosquatting Score",
            "Brand Position",
            "Domain Age (days)",
            "HTTPS Enabled",
            "Tunneling Detected",
            "SSIM Similarity (%)",
            "Favicon Similarity (%)"
        ]

        return base_columns + feature_columns
    
    def _load_job_data(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Load job data including features and prediction"""
        # Find job directory
        for domain_dir in self.settings.data_root.iterdir():
            if not domain_dir.is_dir() or domain_dir.name == "batch_jobs":
                continue
            
            for timestamp_dir in domain_dir.iterdir():
                if not timestamp_dir.is_dir():
                    continue
                
                features_file = timestamp_dir / "features.json"
                if features_file.exists():
                    with open(features_file, 'r') as f:
                        features = json.load(f)
                    
                    metadata = features.get('metadata', {}) or {}
                    features_job_id = metadata.get('job_id') or features.get('job_id')
                    input_url = features.get('input_url') or features.get('url')

                    # Check if this is the right job by job_id or URL match
                    if features_job_id == job_id or (input_url and input_url in job_id):
                        return {
                            'features': features,
                            'timestamp_dir': timestamp_dir,
                            'domain': metadata.get('registered_domain', domain_dir.name)
                        }

        return None
    
    def _create_ps02_row(
        self,
        job_data: Dict[str, Any],
        application_id: str,
        source_of_detection: str,
        cse_domain_name: str,
        cse_name: str
    ) -> Dict[str, Any]:
        """Create a PS-02 format row from job data"""
        features = job_data['features']
        ml_features = features.get('ml_features', {})
        ml_prediction = features.get('ml_prediction', {})
        timestamp_dir = job_data['timestamp_dir']
        
        # Extract URL and domain
        url = features.get('input_url', features.get('url', ''))
        domain = ml_features.get('domain', job_data.get('domain', ''))

        # Determine class label
        prediction = ml_prediction.get('prediction', 'unknown')
        confidence = ml_prediction.get('confidence', 0.0)

        if prediction.lower() == 'phishing':
            class_label = f"Phishing (Confidence: {confidence:.2%})"
        elif prediction.lower() == 'legitimate':
            class_label = f"Legitimate (Confidence: {confidence:.2%})"
        else:
            class_label = "Suspected"

        raw_prediction_label = prediction.title() if isinstance(prediction, str) and prediction else "Unknown"
        
        # Extract WHOIS data
        whois_data = features.get('whois', {})
        domain_reg_date = self._format_date(whois_data.get('creation_date'))
        registrar_name = whois_data.get('registrar', 'N/A')
        registrant_name = whois_data.get('registrant_name', whois_data.get('registrant_org', 'N/A'))
        registrant_country = whois_data.get('registrant_country', 'N/A')
        
        # Extract DNS data
        dns_data = features.get('dns', {})
        name_servers = ', '.join(dns_data.get('ns_records', [])) or 'N/A'
        hosting_ip = ', '.join(dns_data.get('a_records', [])) or 'N/A'
        
        # DNS Records summary
        dns_records = self._format_dns_records(dns_data)
        
        # Extract network data
        network_data = features.get('network', {})
        hosting_isp = network_data.get('isp', 'N/A')
        hosting_country = network_data.get('country', 'N/A')
        
        # Evidence file name
        evidence_files = []
        if (timestamp_dir / "screenshot.png").exists():
            evidence_files.append("screenshot.png")
        if (timestamp_dir / "page.html").exists():
            evidence_files.append("page.html")
        if (timestamp_dir / "features.json").exists():
            evidence_files.append("features.json")
        evidence_filename = ', '.join(evidence_files) if evidence_files else 'N/A'
        
        # Detection date and time
        created_at = features.get('created_at', datetime.now(timezone.utc).isoformat())
        detection_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        detection_date = detection_dt.strftime('%d-%m-%Y')
        detection_time = detection_dt.strftime('%H-%M-%S')
        
        # Remarks
        remarks = []
        if ml_prediction.get('reasoning'):
            remarks.extend(ml_prediction['reasoning'][:3])  # Top 3 reasons
        
        # Add risk indicators
        if ml_features.get('typosquatting_score_encoded', 1) >= 2:
            remarks.append("Typosquatting detected")
        if ml_features.get('misleading_keyword_present', 0) == 1:
            remarks.append("Contains misleading keywords")
        if ml_features.get('HTTPS_Yes', 0) == 0:
            remarks.append("No HTTPS")
        
        remarks_text = '; '.join(remarks) if remarks else 'N/A'
        
        def bool_to_yes_no(value: Any) -> Optional[str]:
            if value is None:
                return None
            if isinstance(value, str):
                lowered = value.strip().lower()
                if lowered in {"", "n/a"}:
                    return None
                return "Yes" if lowered in {"yes", "y", "true", "1"} else "No"
            if isinstance(value, (int, float)):
                return "Yes" if value != 0 else "No"
            if isinstance(value, bool):
                return "Yes" if value else "No"
            return None

        def get_feature(name: str, fallback: Any = None) -> Any:
            return ml_features.get(name, fallback) if isinstance(ml_features, dict) else fallback

        favicon_similarity = get_feature('favicon_similarity_score')
        if favicon_similarity is None:
            favicon_similarity = get_feature('favicon_similarity')

        metadata = features.get('metadata') or {}

        def _clean_str(value: Any) -> Optional[str]:
            if not isinstance(value, str):
                return None
            cleaned = value.strip()
            return cleaned or None

        legitimate_domain = _clean_str(metadata.get('legitimate_domain'))
        brand_hint = _clean_str(metadata.get('brand_hint') or features.get('brand_hint'))

        mappings: Optional[Dict[str, str]] = None

        if not legitimate_domain and brand_hint:
            try:
                from URLshield.keyword_config import get_keyword_config
                mappings = get_keyword_config().get_brand_mappings()
                legitimate_domain = mappings.get(brand_hint.lower())
            except Exception as exc:
                logger.warning(
                    "brand_mapping_lookup_failed",
                    brand_hint=brand_hint,
                    error=str(exc),
                )

        if not legitimate_domain:
            try:
                legitimate_domain = find_best_matching_legitimate_domain(url)
            except Exception as exc:
                logger.warning(
                    "legitimate_domain_fallback_failed",
                    url=url,
                    error=str(exc),
                )

        if mappings is None:
            try:
                from URLshield.keyword_config import get_keyword_config
                mappings = get_keyword_config().get_brand_mappings()
            except Exception as exc:
                logger.warning("brand_mappings_load_failed", error=str(exc))
                mappings = {}

        brand_name = brand_hint

        if not brand_name and legitimate_domain and mappings:
            reverse_map = {domain.lower(): brand for brand, domain in mappings.items()}
            brand_name = reverse_map.get(legitimate_domain.lower())

        if not brand_name and legitimate_domain:
            first_label = legitimate_domain.split('.')[0]
            if first_label:
                brand_name = first_label.upper()

        if not brand_name:
            brand_name = cse_name or "Unknown"

        cse_domain_value = legitimate_domain or cse_domain_name or "N/A"

        row = {
            "Application_ID": "AIGR-S76459",
            "Source of detection": "Automated System(Crawler + AI/ML Model)",
            "Identified Phishing/Suspected Domain Name": domain,
            "Corresponding CSE Domain Name": cse_domain_value,
            "Critical Sector Entity Name": brand_name,
            "Phishing/Suspected Domains (i.e. Class Label)": raw_prediction_label,
            "Domain Registration Date": domain_reg_date,
            "Registrar Name": registrar_name,
            "Registrant Name or Registrant Organisation": registrant_name,
            "Registrant Country": registrant_country,
            "Name Servers": name_servers,
            "Hosting IP": hosting_ip,
            "Hosting ISP": hosting_isp,
            "Hosting Country": hosting_country,
            "DNS Records (if any)": dns_records,
            "Evidence file name": evidence_filename,
            "Date of detection (DD-MM-YYYY)": detection_date,
            "Time of detection (HH-MM-SS)": detection_time,
            "Date of Post (If detection is from Source: social media)": "N/A",
            "Remarks (If any)": remarks_text
        }

        risk_score = ml_prediction.get('risk_score')
        if risk_score is not None:
            risk_score = risk_score * 100

        row.update({
            "Prediction Confidence (%)": confidence * 100 if confidence is not None else None,
            "Risk Score (%)": risk_score,
            "URL Length": get_feature('url_length'),
            "Domain Length": get_feature('domain_length'),
            "Path Length": get_feature('path_length'),
            "Subdomain Count": get_feature('num_subdomains'),
            "Dot Count": get_feature('num_dots'),
            "Hyphen Count": get_feature('domain_num_hyphens'),
            "Special Character Count": get_feature('num_special_chars'),
            "URL Entropy": get_feature('url_entropy'),
            "IDN Domain": bool_to_yes_no(get_feature('is_idn')),
            "Brand Word Present": bool_to_yes_no(get_feature('brand_word_present')),
            "Misleading Keywords Present": bool_to_yes_no(get_feature('misleading_keyword_present')),
            "Typosquatting Score": get_feature('typosquatting_score'),
            "Brand Position": get_feature('brand_position'),
            "Domain Age (days)": get_feature('domain_age_days'),
            "HTTPS Enabled": bool_to_yes_no(get_feature('HTTPS', '').lower() if isinstance(get_feature('HTTPS'), str) else get_feature('HTTPS')),
            "Tunneling Detected": bool_to_yes_no(get_feature('Is_Tunneling')),
            "SSIM Similarity (%)": get_feature('ssim_score') * 100 if get_feature('ssim_score') is not None else None,
            "Favicon Similarity (%)": favicon_similarity * 100 if favicon_similarity is not None else None,
        })

        def _format_dns_extra(label: str, value: Any, precision: int = 2) -> Optional[str]:
            if value is None:
                return None
            if isinstance(value, (int, float)):
                fmt = f"{value:.{precision}f}" if isinstance(value, float) else str(value)
                return f"{label}: {fmt}"
            if isinstance(value, str):
                cleaned = value.strip()
                if cleaned:
                    return f"{label}: {cleaned}"
                return None
            return None

        ttl_extra = _format_dns_extra("TTL avg", get_feature('ttl_avg'), precision=0)
        asn_extra = _format_dns_extra("ASN", get_feature('asn_number'), precision=0)
        entropy_extra = _format_dns_extra("Reverse DNS entropy", get_feature('reverse_dns_entropy'), precision=2)

        extras = [value for value in (ttl_extra, asn_extra, entropy_extra) if value]

        if extras:
            base_dns = row.get("DNS Records (if any)") or ""
            extra_text = '; '.join(extras)
            if base_dns and base_dns != 'N/A':
                row["DNS Records (if any)"] = f"{base_dns}; {extra_text}"
            else:
                row["DNS Records (if any)"] = extra_text

        return row
    
    def _format_date(self, date_value: Any) -> str:
        """Format date to DD-MM-YYYY"""
        if not date_value:
            return 'N/A'
        
        try:
            if isinstance(date_value, str):
                dt = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
            elif isinstance(date_value, datetime):
                dt = date_value
            else:
                return 'N/A'
            
            return dt.strftime('%d-%m-%Y')
        except Exception:
            return 'N/A'
    
    def _format_dns_records(self, dns_data: Dict[str, Any]) -> str:
        """Format DNS records summary"""
        records = []
        
        if dns_data.get('a_records'):
            records.append(f"A: {', '.join(dns_data['a_records'][:3])}")
        if dns_data.get('aaaa_records'):
            records.append(f"AAAA: {', '.join(dns_data['aaaa_records'][:2])}")
        if dns_data.get('mx_records'):
            records.append(f"MX: {', '.join(dns_data['mx_records'][:2])}")
        if dns_data.get('txt_records'):
            records.append(f"TXT: {len(dns_data['txt_records'])} records")
        
        return '; '.join(records) if records else 'N/A'


def get_batch_exporter(settings: Settings) -> BatchExporter:
    """Get batch exporter instance"""
    return BatchExporter(settings)

