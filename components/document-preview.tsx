'use client';

import { useState } from 'react';
import { Download, FileJson } from 'lucide-react';
import { downloadHTML as downloadHTMLFile, downloadJSON as downloadJSONFile } from '@/lib/download';

interface DocumentPreviewProps {
  document: {
    success: boolean;
    html: string;
    json: Record<string, any>;
    fileName: string;
    message?: string;
  };
}

export function DocumentPreview({ document: doc }: DocumentPreviewProps) {
  const [showJson, setShowJson] = useState(false);

  const handleDownloadHTML = () => {
    downloadHTMLFile(doc.html, doc.fileName);
  };

  const handleDownloadJSON = () => {
    downloadJSONFile(doc.json, doc.fileName.replace('.html', '.json'));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Document Preview</h2>
          <p className="text-muted-foreground mt-1">File: {doc.fileName}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadHTML}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-opacity-90 transition-all font-medium"
          >
            <Download size={18} />
            Download HTML
          </button>
          <button
            onClick={handleDownloadJSON}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-opacity-90 transition-all font-medium"
          >
            <FileJson size={18} />
            Download JSON
          </button>
        </div>
      </div>

      {/* Toggle between HTML and JSON */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setShowJson(false)}
          className={`px-4 py-2 font-medium transition-colors ${
            !showJson ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
          }`}
        >
          Preview
        </button>
        <button
          onClick={() => setShowJson(true)}
          className={`px-4 py-2 font-medium transition-colors ${
            showJson ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
          }`}
        >
          JSON Data
        </button>
      </div>

      {/* Content */}
      {!showJson ? (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <iframe
            srcDoc={doc.html}
            title="Document Preview"
            className="w-full min-h-96"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-background p-4 overflow-auto max-h-96">
          <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-words">
            {JSON.stringify(doc.json, null, 2)}
          </pre>
        </div>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted bg-opacity-50 p-4 rounded-lg">
          <p className="text-xs text-muted-foreground font-semibold">Generated</p>
          <p className="text-sm text-foreground mt-1">{new Date().toLocaleString()}</p>
        </div>
        <div className="bg-muted bg-opacity-50 p-4 rounded-lg">
          <p className="text-xs text-muted-foreground font-semibold">Fields Extracted</p>
          <p className="text-sm text-foreground mt-1">{Object.keys(doc.json).length} fields</p>
        </div>
      </div>
    </div>
  );
}
