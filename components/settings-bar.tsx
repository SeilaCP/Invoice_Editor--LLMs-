'use client';

import { useState, useEffect } from 'react';
import { getProviderSettings, setActiveProviderAction } from '@/app/actions';
import { Settings } from 'lucide-react';

interface SettingsBarProps {
  onRefresh: () => void;
}

export function SettingsBar({ onRefresh }: SettingsBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [activeProvider, setActiveProvider] = useState<string>('gemini');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const result = await getProviderSettings();
      if (result.success) {
        setProviders(result.providers || []);
        setActiveProvider(result.activeProvider || 'gemini');
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const handleProviderChange = async (provider: string) => {
    setLoading(true);
    try {
      const result = await setActiveProviderAction(provider as any);
      if (result.success) {
        setActiveProvider(provider);
        onRefresh();
      }
    } catch (error) {
      console.error('Error changing provider:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card hover:bg-muted border border-border transition-colors"
      >
        <Settings size={20} />
        <span className="text-sm font-medium">Settings</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-lg p-6 z-50">
          <h3 className="text-lg font-bold text-foreground mb-4">Settings</h3>

          {/* LLM Provider Selection */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground block mb-3">LLM Provider</label>
              <p className="text-xs text-muted-foreground mb-3">
                Select which AI provider to use for document generation. All providers are supported but only the active one will be used.
              </p>
              <div className="space-y-2">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handleProviderChange(provider.id)}
                    disabled={loading}
                    className={`w-full p-3 rounded-lg text-left text-sm font-medium transition-all ${
                      activeProvider === provider.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground hover:bg-muted hover:bg-opacity-70'
                    } disabled:opacity-50`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{provider.name}</span>
                      {activeProvider === provider.id && <span className="text-xs">✓ Active</span>}
                    </div>
                    <p className="text-xs opacity-70 mt-1">{provider.model}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* API Key Configuration Info */}
            <div className="bg-accent bg-opacity-10 p-3 rounded-lg border border-accent">
              <p className="text-xs font-semibold text-foreground mb-2">API Key Configuration</p>
              <p className="text-xs text-muted-foreground">
                API keys are managed via environment variables or the Vercel AI Gateway. Configure your API keys in your project settings.
              </p>
            </div>

            {/* Provider Info */}
            <div className="bg-muted bg-opacity-50 p-3 rounded-lg">
              <p className="text-xs font-semibold text-foreground mb-2">Current Provider</p>
              <p className="text-xs text-muted-foreground">
                <strong>{activeProvider.toUpperCase()}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                All providers have access to the same document generation pipeline. Switch providers anytime to compare results or handle provider outages.
              </p>
            </div>

            {/* Additional Settings */}
            <div className="border-t border-border pt-4 mt-4">
              <p className="text-sm font-semibold text-foreground mb-3">Other Settings</p>
              <p className="text-xs text-muted-foreground">
                For additional settings like custom templates, skill management, and memory configuration, navigate to the respective tabs in the dashboard.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="w-full mt-4 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-opacity-70 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
