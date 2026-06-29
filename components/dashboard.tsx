'use client';

import { useState, useEffect } from 'react';
import { DocumentGenerator } from './document-generator';
import { SettingsBar } from './settings-bar';
import { DocumentPreview } from './document-preview';
import { MemoryManager } from './memory-manager';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'generator' | 'preview' | 'settings' | 'memory'>('generator');
  const [generatedDocument, setGeneratedDocument] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDocumentGenerated = (doc: any) => {
    setGeneratedDocument(doc);
    setActiveTab('preview');
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Document Generator</h1>
              <p className="text-muted-foreground mt-1">AI-powered invoice, quotation, and proposal generation</p>
            </div>
            <SettingsBar onRefresh={handleRefresh} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Navigation Tabs */}
          <div className="lg:col-span-1">
            <nav className="flex flex-col gap-2">
              <button
                onClick={() => setActiveTab('generator')}
                className={`px-4 py-3 rounded-lg text-left font-medium transition-colors ${
                  activeTab === 'generator'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-foreground hover:bg-muted'
                }`}
              >
                Generate Document
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-3 rounded-lg text-left font-medium transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-foreground hover:bg-muted'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setActiveTab('memory')}
                className={`px-4 py-3 rounded-lg text-left font-medium transition-colors ${
                  activeTab === 'memory'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-foreground hover:bg-muted'
                }`}
              >
                Memory & Context
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-3 rounded-lg text-left font-medium transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-foreground hover:bg-muted'
                }`}
              >
                Settings
              </button>
            </nav>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            {activeTab === 'generator' && (
              <div className="bg-card rounded-lg border border-border p-8">
                <DocumentGenerator onDocumentGenerated={handleDocumentGenerated} />
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="bg-card rounded-lg border border-border p-8">
                {generatedDocument ? (
                  <DocumentPreview document={generatedDocument} />
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No document generated yet. Generate a document first.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'memory' && (
              <div className="bg-card rounded-lg border border-border p-8">
                <MemoryManager key={refreshKey} />
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="bg-card rounded-lg border border-border p-8">
                <SettingsBar onRefresh={handleRefresh} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
