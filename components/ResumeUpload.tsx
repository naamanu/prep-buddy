import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { extractTextFromFile, validatePastedText, type PDFExtractionResult } from '../services/pdfUtils';

interface ResumeUploadProps {
  onTextExtracted: (text: string) => void;
  isLoading?: boolean;
}

const ResumeUpload: React.FC<ResumeUploadProps> = ({ onTextExtracted, isLoading = false }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setSelectedFile(file);

    const result: PDFExtractionResult = await extractTextFromFile(file);

    if (!result.success) {
      setError(result.error || 'Failed to extract text from file');
      setSelectedFile(null);
      return;
    }

    onTextExtracted(result.text);
  }, [onTextExtracted]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handlePasteSubmit = useCallback(() => {
    setError(null);
    const result = validatePastedText(pastedText);

    if (!result.success) {
      setError(result.error || 'Invalid text');
      return;
    }

    onTextExtracted(result.text);
  }, [pastedText, onTextExtracted]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex border-2 border-black border-b-0">
        <button
          onClick={() => { setActiveTab('upload'); setError(null); }}
          className={`flex-1 px-4 py-3 font-mono text-sm uppercase tracking-wide border-r-2 border-black transition-colors ${
            activeTab === 'upload'
              ? 'bg-black text-white'
              : 'bg-white text-black hover:bg-gray-100'
          }`}
        >
          Upload File
        </button>
        <button
          onClick={() => { setActiveTab('paste'); setError(null); }}
          className={`flex-1 px-4 py-3 font-mono text-sm uppercase tracking-wide transition-colors ${
            activeTab === 'paste'
              ? 'bg-black text-white'
              : 'bg-white text-black hover:bg-gray-100'
          }`}
        >
          Paste Text
        </button>
      </div>

      {/* Content Area */}
      <div className="border-2 border-black shadow-retro-lg bg-white p-6">
        {activeTab === 'upload' ? (
          <div className="space-y-4">
            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-black bg-gray-100'
                  : 'border-gray-400 hover:border-black hover:bg-gray-50'
              } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 size={48} className="text-gray-400 animate-spin" />
                  <p className="text-sm text-gray-600 font-mono">Analyzing your resume...</p>
                </div>
              ) : selectedFile ? (
                <div className="flex flex-col items-center gap-4">
                  <FileText size={48} className="text-green-600" />
                  <div>
                    <p className="text-sm font-mono font-bold">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">Click to select a different file</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <Upload size={48} className="text-gray-400" />
                  <div>
                    <p className="text-sm font-mono">Drop your resume here</p>
                    <p className="text-xs text-gray-500 mt-1">or click to browse</p>
                  </div>
                  <p className="text-xs text-gray-400 font-mono">Supports PDF and TXT files</p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.text,application/pdf,text/plain"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Paste Area */}
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your resume text here..."
              disabled={isLoading}
              className="w-full h-64 p-4 border-2 border-black font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
            />

            <button
              onClick={handlePasteSubmit}
              disabled={!pastedText.trim() || isLoading}
              className="w-full px-4 py-3 bg-black text-white font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-retro flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Parse Resume'
              )}
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border-2 border-red-500 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-red-700 font-medium">Error</p>
              <p className="text-sm text-red-600 mt-1 break-all">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeUpload;
