"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { uploadDocxTemplate, uploadPdf } from "@/app/actions";

interface UploadSectionProps {
  type: "docx" | "pdf";
  title: string;
  description: string;
  onUploadSuccess: () => void;
}

export function UploadSection({
  type,
  title,
  description,
  onUploadSuccess,
}: UploadSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      let result;
      if (type === "docx") {
        result = await uploadDocxTemplate(formData);
      } else {
        result = await uploadPdf(formData);
      }

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        onUploadSuccess();
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        setError(result.error || "Upload failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.add("border-primary", "bg-primary/5");
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.remove("border-primary", "bg-primary/5");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.remove("border-primary", "bg-primary/5");
    }

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const lowerName = file.name.toLowerCase();
      const isCorrectType =
        type === "docx"
          ? lowerName.endsWith(".docx") || lowerName.endsWith(".doc")
          : lowerName.endsWith(".pdf");
      if (isCorrectType) {
        handleUpload(file);
      } else {
        setError(
          `Please upload a ${type === "docx" ? "DOC or DOCX" : "PDF"} file`,
        );
      }
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div
        ref={dragRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-primary hover:bg-primary/5"
      >
        <div className="mb-4">
          <div className="text-4xl mb-3">{type === "docx" ? "📄" : "📕"}</div>
        </div>

        <p className="text-foreground font-medium mb-2">
          Drag & drop your file here
        </p>
        <p className="text-sm text-muted-foreground mb-4">or click to browse</p>

        <input
          ref={fileInputRef}
          type="file"
          accept={type === "docx" ? ".doc,.docx" : ".pdf"}
          onChange={handleFileChange}
          disabled={isLoading}
          className="hidden"
        />

        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="bg-accent hover:bg-accent-light text-white"
        >
          {isLoading ? "Uploading..." : "Select File"}
        </Button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          File uploaded successfully!
        </div>
      )}
    </div>
  );
}
