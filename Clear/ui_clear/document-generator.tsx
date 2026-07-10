"use client";

import { useState } from "react";
import {
  generateDocumentAction,
  getProviderSettings,
  detectTemplateTypeAction,
} from "@/app/actions";
import { useEffect } from "react";

interface DocumentGeneratorProps {
  onDocumentGenerated: (document: any) => void;
}

export function DocumentGenerator({
  onDocumentGenerated,
}: DocumentGeneratorProps) {
  const [templateType, setTemplateType] = useState<
    "invoice" | "quotation" | "proposal"
  >("invoice");
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>("gemini");
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);
  const [suggestedTemplate, setSuggestedTemplate] = useState<
    "invoice" | "quotation" | "proposal" | null
  >(null);
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    // Fetch active provider on mount
    const fetchProvider = async () => {
      try {
        const result = await getProviderSettings();
        if (
          result.success &&
          "activeProvider" in result &&
          result.activeProvider
        ) {
          setActiveProvider(result.activeProvider);
        }
      } catch (err) {
        console.error("Error fetching provider:", err);
      }
    };
    fetchProvider();
  }, []);

  // Auto-detect template type when user input changes
  const handleUserInputChange = async (value: string) => {
    setUserInput(value);
    setSuggestedTemplate(null);

    if (autoDetectEnabled && value.trim().length > 10) {
      setIsDetecting(true);
      try {
        const result = await detectTemplateTypeAction(
          value,
          activeProvider as any,
        );
        if (result.success) {
          setSuggestedTemplate(result.detectedType);
          setTemplateType(result.detectedType);
        }
      } catch (err) {
        console.error("Error detecting template:", err);
      } finally {
        setIsDetecting(false);
      }
    }
  };

  const handleGenerateDocument = async () => {
    if (!userInput.trim()) {
      setError("Please enter some information about the document");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await generateDocumentAction({
        templateType,
        userInput,
        llmProvider: activeProvider as "gemini" | "openai" | "claude" | "qwen",
      });

      if (!result.success) {
        setError(result.error || "Failed to generate document");
        return;
      }

      onDocumentGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-6">
          Generate New Document
        </h2>
      </div>

      {/* Auto-Detect Toggle */}
      <div className="flex items-center justify-between bg-accent bg-opacity-5 p-4 rounded-lg border border-accent">
        <div>
          <label className="text-sm font-semibold text-foreground">
            Auto-Detect Document Type
          </label>
          <p className="text-xs text-muted-foreground mt-1">
            AI will automatically suggest the best template as you type
          </p>
        </div>
        <button
          onClick={() => {
            setAutoDetectEnabled(!autoDetectEnabled);
            setSuggestedTemplate(null);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            autoDetectEnabled
              ? "bg-accent text-accent-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {autoDetectEnabled ? "On" : "Off"}
        </button>
      </div>

      {/* Template Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-foreground">
            Document Type
          </label>
          {isDetecting && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Detecting...
            </span>
          )}
          {suggestedTemplate && !isDetecting && (
            <span className="text-xs bg-accent bg-opacity-20 text-accent-foreground px-2 py-1 rounded">
              Suggested: {suggestedTemplate}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {["invoice", "quotation", "proposal"].map((type) => (
            <button
              key={type}
              onClick={() => {
                setTemplateType(type as any);
                setAutoDetectEnabled(false); // Disable auto-detect when manually selected
              }}
              className={`p-4 rounded-lg border-2 transition-all font-medium capitalize ${
                templateType === type
                  ? "border-primary bg-primary bg-opacity-10 text-primary"
                  : "border-border bg-card text-foreground hover:border-primary hover:bg-opacity-5"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* User Input */}
      <div className="space-y-3">
        <label
          htmlFor="user-input"
          className="block text-sm font-semibold text-foreground"
        >
          Information
        </label>
        <p className="text-sm text-muted-foreground">
          Provide minimal details about the {templateType}. AI will extract and
          auto-fill the rest.
        </p>
        <textarea
          id="user-input"
          value={userInput}
          onChange={(e) => handleUserInputChange(e.target.value)}
          placeholder="E.g., Create an invoice for John Doe, $5000, due Dec 31. Service: web development. (Auto-detect will suggest the right template)"
          className="w-full min-h-32 p-4 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      {/* Active Provider Display */}
      <div className="bg-muted bg-opacity-50 p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold">Active Provider:</span>{" "}
          {activeProvider}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Change provider in Settings
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-destructive bg-opacity-10 border border-destructive text-destructive p-4 rounded-lg">
          <p className="text-sm font-semibold">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerateDocument}
        disabled={isLoading}
        className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isLoading ? "Generating..." : "Generate Document"}
      </button>

      {/* Tips */}
      <div className="bg-accent bg-opacity-10 border border-accent p-4 rounded-lg">
        <h4 className="font-semibold text-foreground text-sm mb-2">
          Tips for Best Results:
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Be specific with amounts, dates, and client names</li>
          <li>• Include key items or services in your description</li>
          <li>• Mention any special terms or conditions</li>
          <li>• Use saved memory context for faster generation</li>
        </ul>
      </div>
    </div>
  );
}
