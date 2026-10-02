import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, X, RefreshCw, Globe } from 'lucide-react';
import { Card, CardHeader, CardContent } from './Card';
import { Button } from './Button';
import { Input } from './Input';

type ToastState = {
  type: 'success' | 'error';
  text: string;
} | null;

type BrandMapping = {
  brand: string;
  domain: string;
};

const API_BASE = 'http://localhost:8080';
const API_KEY = 'lAm3493F0AW0p-ARuvNYENhcYSY-RxNio5Q-o8p15oc';

export const BrandDomainManager: React.FC = () => {
  const [mappings, setMappings] = useState<BrandMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<ToastState>(null);
  const [form, setForm] = useState({ brand: '', domain: '' });
  const [editingBrand, setEditingBrand] = useState<string | null>(null);

  const sortedMappings = useMemo(
    () =>
      [...mappings].sort((a, b) => a.brand.localeCompare(b.brand)),
    [mappings]
  );

  useEffect(() => {
    fetchBrandMappings();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3500);
  };

  const resetForm = () => {
    setForm({ brand: '', domain: '' });
    setEditingBrand(null);
  };

  const fetchBrandMappings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/keywords/brands`, {
        headers: {
          'X-API-Key': API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch brand mappings');
      }

      const data = await response.json();
      setMappings(data.brand_mappings || []);
    } catch (error) {
      console.error('Error fetching brand mappings:', error);
      showMessage('error', 'Unable to load brand mappings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    const brand = form.brand.trim().toLowerCase();
    const domain = form.domain.trim().toLowerCase();

    if (!brand || !domain) {
      showMessage('error', 'Both brand and domain are required');
      return;
    }

    setIsSaving(true);
    try {
      // If we are renaming a brand, delete the old record first
      if (editingBrand && editingBrand !== brand) {
        await fetch(`${API_BASE}/keywords/brands/${encodeURIComponent(editingBrand)}`, {
          method: 'DELETE',
          headers: {
            'X-API-Key': API_KEY,
          },
        });
      }

      const response = await fetch(`${API_BASE}/keywords/brands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({ brand, domain }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || 'Failed to save mapping');
      }

      showMessage('success', `Saved mapping for ${brand}`);
      resetForm();
      await fetchBrandMappings();
    } catch (error) {
      console.error('Error saving brand mapping:', error);
      showMessage('error', 'Failed to save brand mapping');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (mapping: BrandMapping) => {
    setForm({ brand: mapping.brand, domain: mapping.domain });
    setEditingBrand(mapping.brand);
  };

  const handleRemove = async (brand: string) => {
    if (!window.confirm(`Remove mapping for ${brand}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/keywords/brands/${encodeURIComponent(brand)}`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': API_KEY,
        },
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || 'Failed to remove mapping');
      }

      showMessage('success', `Removed mapping for ${brand}`);
      await fetchBrandMappings();
      if (editingBrand === brand) {
        resetForm();
      }
    } catch (error) {
      console.error('Error removing brand mapping:', error);
      showMessage('error', 'Failed to remove brand mapping');
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`fixed top-20 right-8 z-50 px-4 py-3 rounded-lg shadow-lg ${
            message.type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text">Brand Domain Management</h2>
          <p className="text-sm text-text-secondary mt-1">
            Maintain known legitimate domains for each brand to improve detection confidence
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchBrandMappings} disabled={isLoading}>
          <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe size={20} className="text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-text">
                {editingBrand ? 'Edit Mapping' : 'Add Brand Mapping'}
              </h3>
              <p className="text-sm text-text-secondary">
                {editingBrand
                  ? `Updating mapping for ${editingBrand}`
                  : 'Define the genuine domain associated with each brand'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Brand Name"
              placeholder="e.g. paypal"
              value={form.brand}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, brand: event.target.value }))
              }
              disabled={isSaving}
            />
            <Input
              label="Legitimate Domain"
              placeholder="e.g. paypal.com"
              value={form.domain}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, domain: event.target.value }))
              }
              disabled={isSaving}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSubmit} disabled={isSaving}>
              <Plus size={16} className="mr-2" />
              {editingBrand ? 'Save Changes' : 'Add Mapping'}
            </Button>
            {editingBrand && (
              <Button variant="secondary" size="sm" onClick={resetForm} disabled={isSaving}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text">Configured Brand Domains</h3>
            <span className="text-sm text-text-secondary">{sortedMappings.length} mappings</span>
          </div>
        </CardHeader>
        <CardContent>
          {sortedMappings.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <Globe size={48} className="mx-auto mb-3 opacity-40" />
              <p>No brand domains configured yet.</p>
              <p className="text-sm">Add mappings above to link brand names to their official domains.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedMappings.map((mapping) => (
                <div
                  key={mapping.brand}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 bg-bg rounded-lg border border-border hover:border-primary/50 transition-all duration-150"
                >
                  <div>
                    <p className="text-sm text-text-secondary uppercase tracking-wide">Brand</p>
                    <p className="text-lg font-semibold text-text">{mapping.brand}</p>
                  </div>
                  <div className="md:flex-1">
                    <p className="text-sm text-text-secondary uppercase tracking-wide">Domain</p>
                    <p className="text-lg font-medium text-text break-all">{mapping.domain}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEdit(mapping)}
                      title="Edit mapping"
                      className="px-2"
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemove(mapping.brand)}
                      title="Remove mapping"
                      className="px-2"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
