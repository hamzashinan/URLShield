import React from 'react';
import { Card, CardHeader, CardContent } from './Card';
import { Globe, MapPin, Server, Calendar, Shield } from 'lucide-react';
import type { DomainDetails } from '../types/api';

type DomainDetailsCardProps = {
  details: DomainDetails | null | undefined;
};

const DetailRow: React.FC<{ label: string; value?: string | null; icon?: React.ReactNode }> = ({ label, value, icon }) => {
  if (!value) {
    return null;
  }

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      {icon && <span className="text-primary mt-0.5">{icon}</span>}
      <div>
        <p className="text-xs text-text-secondary uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-text mt-0.5 break-all">{value}</p>
      </div>
    </div>
  );
};

const ListRow: React.FC<{ label: string; values?: string[]; icon?: React.ReactNode }> = ({ label, values, icon }) => {
  if (!values || values.length === 0) {
    return null;
  }

  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-2 mb-2 text-xs text-text-secondary uppercase tracking-wide">
        {icon && <span className="text-primary mt-0.5">{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map((item, index) => (
          <span
            key={`${label}-${item}-${index}`}
            className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full border border-primary/20"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

export const DomainDetailsCard: React.FC<DomainDetailsCardProps> = ({ details }) => {
  if (!details) {
    return (
      <Card>
        <CardContent className="text-center py-6 text-text-secondary text-sm">
          <p>No domain metadata available for this URL yet.</p>
          <p className="mt-1">WHOIS or DNS lookups may have failed or not been collected.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-primary" />
          <h3 className="text-lg font-semibold text-text">Domain Registration & Hosting Details</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailRow
            label="Domain Registration Date"
            value={details.domain_registration_date}
            icon={<Calendar size={14} />}
          />
          <DetailRow
            label="Registrar Name"
            value={details.registrar_name}
            icon={<Globe size={14} />}
          />
          <DetailRow
            label="Registrant Name or Organisation"
            value={details.registrant_name}
            icon={<Shield size={14} />}
          />
          <DetailRow
            label="Registrant Country"
            value={details.registrant_country}
            icon={<MapPin size={14} />}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ListRow
            label="Name Servers"
            values={details.name_servers}
            icon={<Server size={14} />}
          />
          <ListRow
            label="Hosting IPs"
            values={details.hosting_ips}
            icon={<Server size={14} />}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailRow
            label="Hosting ISP"
            value={details.hosting_isp}
            icon={<Globe size={14} />}
          />
          <DetailRow
            label="Hosting Country"
            value={details.hosting_country}
            icon={<MapPin size={14} />}
          />
        </div>
      </CardContent>
    </Card>
  );
};
