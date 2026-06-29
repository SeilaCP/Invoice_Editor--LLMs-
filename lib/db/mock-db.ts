// Mock in-memory database for development
// This will be replaced with actual SQLite later
// For now, we use localStorage on client and memory on server

interface Memory {
  id: number;
  key: string;
  content: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface Setting {
  id: number;
  key: string;
  value: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface GeneratedDocument {
  id: number;
  templateId: number;
  userInput: string;
  extractedJson: string;
  generatedHtml: string;
  fileName: string;
  createdAt: string;
}

class MockDatabase {
  private memories: Map<string, Memory> = new Map();
  private settings: Map<string, Setting> = new Map();
  private documents: GeneratedDocument[] = [];
  private nextId = { memory: 1, setting: 1, document: 1 };

  // Initialize with default settings
  constructor() {
    this.initializeDefaults();
  }

  private initializeDefaults() {
    this.setSetting('active_llm_provider', 'gemini', 'Active LLM provider');
  }

  // Memory operations
  getMemory(key: string): Memory | null {
    return this.memories.get(key) || null;
  }

  getAllMemories(): Memory[] {
    return Array.from(this.memories.values());
  }

  setMemory(key: string, content: any, description?: string): Memory {
    const existing = this.memories.get(key);
    const now = new Date().toISOString();

    if (existing) {
      existing.content = JSON.stringify(content);
      existing.description = description;
      existing.updatedAt = now;
      return existing;
    }

    const memory: Memory = {
      id: this.nextId.memory++,
      key,
      content: JSON.stringify(content),
      description,
      createdAt: now,
      updatedAt: now,
    };

    this.memories.set(key, memory);
    return memory;
  }

  deleteMemory(key: string): boolean {
    return this.memories.delete(key);
  }

  // Setting operations
  getSetting(key: string): Setting | null {
    return this.settings.get(key) || null;
  }

  getAllSettings(): Setting[] {
    return Array.from(this.settings.values());
  }

  setSetting(key: string, value: string, description?: string): Setting {
    const existing = this.settings.get(key);
    const now = new Date().toISOString();

    if (existing) {
      existing.value = value;
      existing.description = description;
      existing.updatedAt = now;
      return existing;
    }

    const setting: Setting = {
      id: this.nextId.setting++,
      key,
      value,
      description,
      createdAt: now,
      updatedAt: now,
    };

    this.settings.set(key, setting);
    return setting;
  }

  deleteSetting(key: string): boolean {
    return this.settings.delete(key);
  }

  // Document operations
  saveDocument(doc: Omit<GeneratedDocument, 'id' | 'createdAt'>): GeneratedDocument {
    const now = new Date().toISOString();
    const newDoc: GeneratedDocument = {
      ...doc,
      id: this.nextId.document++,
      createdAt: now,
    };

    this.documents.push(newDoc);
    return newDoc;
  }

  getDocuments(): GeneratedDocument[] {
    return this.documents;
  }
}

// Create singleton instance
export const mockDb = new MockDatabase();

// Export helper functions that mimic async operations
export const dbHelpers = {
  async getMemories() {
    return mockDb.getAllMemories();
  },

  async getMemory(key: string) {
    return mockDb.getMemory(key);
  },

  async saveMemory(key: string, content: any, description?: string) {
    return mockDb.setMemory(key, content, description);
  },

  async deleteMemory(key: string) {
    return mockDb.deleteMemory(key);
  },

  async getSetting(key: string) {
    return mockDb.getSetting(key);
  },

  async getAllSettings() {
    return mockDb.getAllSettings();
  },

  async setSetting(key: string, value: string, description?: string) {
    return mockDb.setSetting(key, value, description);
  },

  async deleteSetting(key: string) {
    return mockDb.deleteSetting(key);
  },

  async saveDocument(doc: Omit<GeneratedDocument, 'id' | 'createdAt'>) {
    return mockDb.saveDocument(doc);
  },

  async getDocuments() {
    return mockDb.getDocuments();
  },
};
