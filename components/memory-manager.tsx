'use client';

import { useState, useEffect } from 'react';
import { getMemories, saveMemory, deleteMemory } from '@/app/actions';
import { Plus, Trash2, Save } from 'lucide-react';

export function MemoryManager() {
  const [memories, setMemories] = useState<any[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    try {
      const result = await getMemories();
      if (result.success) {
        setMemories(result.memories || []);
      }
    } catch (err) {
      console.error('Error loading memories:', err);
    }
  };

  const handleSaveMemory = async () => {
    if (!newKey.trim() || !newContent.trim()) {
      setError('Key and content are required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const content = JSON.parse(newContent);
      const result = await saveMemory(newKey, content, newDescription);

      if (result.success) {
        setSuccess('Memory saved successfully!');
        setNewKey('');
        setNewContent('');
        setNewDescription('');
        await loadMemories();
      } else {
        setError(result.error || 'Failed to save memory');
      }
    } catch (parseError) {
      setError('Invalid JSON format in content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMemory = async (key: string) => {
    if (!confirm(`Are you sure you want to delete memory: ${key}?`)) {
      return;
    }

    try {
      const result = await deleteMemory(key);
      if (result.success) {
        setSuccess('Memory deleted successfully!');
        await loadMemories();
      } else {
        setError(result.error || 'Failed to delete memory');
      }
    } catch (err) {
      setError('Error deleting memory');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Memory & Context</h2>
        <p className="text-muted-foreground">
          Save company info, client details, and other context to reuse across document generations for faster processing.
        </p>
      </div>

      {/* Create New Memory */}
      <div className="bg-muted bg-opacity-30 p-6 rounded-lg border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Plus size={20} />
          Add New Memory Context
        </h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="memory-key" className="block text-sm font-semibold text-foreground mb-2">
              Key (identifier)
            </label>
            <input
              id="memory-key"
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="e.g., company_info, default_client"
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="memory-desc" className="block text-sm font-semibold text-foreground mb-2">
              Description (optional)
            </label>
            <input
              id="memory-desc"
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What is this memory for?"
              className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="memory-content" className="block text-sm font-semibold text-foreground mb-2">
              Content (JSON format)
            </label>
            <textarea
              id="memory-content"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={`{\n  "companyName": "Acme Corp",\n  "companyEmail": "info@acme.com",\n  "defaultTax": 0.1\n}`}
              className="w-full min-h-32 p-4 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm resize-none"
            />
          </div>

          {error && (
            <div className="bg-destructive bg-opacity-10 border border-destructive text-destructive p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-300 text-green-700 p-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          <button
            onClick={handleSaveMemory}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-all"
          >
            <Save size={18} />
            {isLoading ? 'Saving...' : 'Save Memory'}
          </button>
        </div>
      </div>

      {/* Existing Memories */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Saved Memories ({memories.length})</h3>

        {memories.length === 0 ? (
          <div className="text-center py-8 bg-muted bg-opacity-30 rounded-lg border border-dashed border-border">
            <p className="text-muted-foreground">No memories saved yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {memories.map((memory) => (
              <div key={memory.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground break-words">{memory.key}</h4>
                    {memory.description && (
                      <p className="text-sm text-muted-foreground mt-1">{memory.description}</p>
                    )}
                    <div className="mt-3 bg-background p-3 rounded border border-border overflow-auto max-h-32">
                      <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">
                        {typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content, null, 2)}
                      </pre>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created: {new Date(memory.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteMemory(memory.key)}
                    className="flex-shrink-0 p-2 rounded-lg bg-destructive bg-opacity-10 text-destructive hover:bg-opacity-20 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Example */}
      <div className="bg-accent bg-opacity-10 border border-accent p-4 rounded-lg">
        <h4 className="font-semibold text-foreground text-sm mb-2">Usage Example:</h4>
        <p className="text-sm text-muted-foreground mb-2">
          When generating a document, the system can automatically include saved context. For example, if you save company info, it will be auto-filled in invoices.
        </p>
        <code className="text-xs bg-background p-2 rounded block font-mono text-muted-foreground overflow-auto">
          {`// Saved memory will be passed as context to LLM\nmemoryContext: {\n  companyName: "Acme Corp",\n  companyEmail: "info@acme.com"\n}`}
        </code>
      </div>
    </div>
  );
}
