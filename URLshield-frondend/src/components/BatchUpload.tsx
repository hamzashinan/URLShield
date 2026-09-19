import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle2, Loader } from 'lucide-react';
import { Button } from './Button';
import { apiClient } from '../lib/api';
import type { BatchUploadResponse } from '../types/api';
import * as XLSX from 'xlsx';

interface BatchUploadProps {
  onUploadComplete?: (batchId: string, totalUrls: number) => void;
  onStartAnalysis?: (batchId: string, urls: string[]) => void;
  /** Optional override for batch API base URL (used for mini backend). */
  apiBaseUrl?: string;
}

export const BatchUpload: React.FC<BatchUploadProps> = ({ onUploadComplete, onStartAnalysis, apiBaseUrl }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileStatus, setFileStatus] = useState<'idle' | 'loading' | 'ready' | 'uploading'>('idle');
  const [fileUrlCount, setFileUrlCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadResponse, setUploadResponse] = useState<BatchUploadResponse | null>(null);
  const [extractedUrls, setExtractedUrls] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    // Validate file type
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      setError('Invalid file format. Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setUploadResponse(null);
    setFileStatus('loading');

    // Parse Excel locally to find total URLs
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to json to count rows
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        // Filter out empty rows and extract URLs from first column
        const nonEmptyRows = jsonData.filter((row: any) => row.length > 0 && row[0]) as any[][];
        let urls: string[] = nonEmptyRows.map((row: any[]) => String(row[0]).trim()).filter((url: string) => url.length > 0);

        // If the first row looks like a header (e.g. "URL" or "url"), skip it
        if (urls.length > 0 && urls[0].toLowerCase().includes('url')) {
          urls = urls.slice(1);
        }
        // Further filter: keep only rows that look like URLs
        urls = urls.filter((url: string) => url.startsWith('http://') || url.startsWith('https://') || url.includes('.'));

        setExtractedUrls(urls);
        setFileUrlCount(urls.length);
        setFileStatus('ready');
      } catch (err) {
        setError('Failed to read Excel file. Make sure it is valid.');
        setFileStatus('idle');
        setSelectedFile(null);
      }
    };
    reader.onerror = () => {
      setError('Error reading file');
      setFileStatus('idle');
      setSelectedFile(null);
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setFileStatus('uploading');
    setError(null);
    setUploadResponse(null);

    try {
      let response: BatchUploadResponse;

      if (!apiBaseUrl) {
        // Default: use main backend via apiClient
        response = await apiClient.uploadBatch(selectedFile);
      } else {
        // Mini backend: call its /batch/upload endpoint directly
        const formData = new FormData();
        formData.append('file', selectedFile);

        const { apiKey } = apiClient.getConfig();
        const url = `${apiBaseUrl}/batch/upload`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
            // Content-Type is set automatically for FormData
          },
          body: formData,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(errText || 'Mini batch upload failed');
        }

        response = (await res.json()) as BatchUploadResponse;
      }
      setUploadResponse(response);
      setSelectedFile(null);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Notify parent component that upload is complete
      if (onUploadComplete) {
        onUploadComplete(response.batch_id, response.total_urls);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
      setFileStatus('ready');
    }
  };

  const handleStartAnalysis = () => {
    if (!uploadResponse) return;
    setIsAnalyzing(true);
    if (onStartAnalysis) {
      onStartAnalysis(uploadResponse.batch_id, extractedUrls);
    }
  };

  const handleReset = () => {
    setUploadResponse(null);
    setExtractedUrls([]);
    setIsAnalyzing(false);
    setError(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setExtractedUrls([]);
    setFileStatus('idle');
    setError(null);
    setUploadResponse(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="pt-2">
        <div className="space-y-6">

          {/* Drop Zone */}
          <div
            className={`
              relative border border-dashed rounded-2xl p-10 text-center transition-all duration-500 group cursor-pointer overflow-hidden backdrop-blur-sm
              ${isDragging ? 'border-primary bg-primary/10 scale-[1.02] shadow-[0_0_40px_rgba(59,130,246,0.15)]' : 'border-white/10 bg-surface/30 hover:border-primary/30 hover:bg-surface/50 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(59,130,246,0.08)]'}
              ${selectedFile ? 'bg-surface-secondary/50' : ''}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
          >
            {!selectedFile ? (
              <>
                <div className="relative z-10">
                  <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-surface/50 border border-white/5 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all duration-500 shadow-sm">
                    <Upload size={28} className="text-text-secondary group-hover:text-primary transition-colors group-hover:-translate-y-1 duration-300" />
                  </div>
                  <p className="text-text mb-2 text-lg">
                    <span className="font-semibold text-primary group-hover:text-blue-400 transition-colors">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-sm text-text-secondary mb-2">
                    Excel files (.xlsx, .xls) up to 10MB
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileInputChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </>
            ) : (
              <div className="flex items-center justify-between bg-surface/60 backdrop-blur-md border border-white/10 rounded-xl p-5 shadow-inner">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <FileSpreadsheet size={24} className="text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-text truncate max-w-[200px] sm:max-w-xs">{selectedFile.name}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                  className="p-2 hover:bg-danger/10 hover:text-danger rounded-lg transition-colors group/remove"
                  disabled={fileStatus === 'uploading'}
                >
                  <X size={20} className="text-text-secondary group-hover/remove:text-danger transition-colors group-hover/remove:rotate-90 duration-300" />
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Success Message */}
          {uploadResponse && !isAnalyzing && (
            <div className="flex items-start gap-2 p-4 bg-success/10 border border-success/20 rounded-lg text-success">
              <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Upload Successful!</p>
                <p className="text-sm mt-1">
                  {uploadResponse.total_urls} URL{uploadResponse.total_urls !== 1 ? 's' : ''} ready for analysis
                </p>
                <p className="text-xs mt-1 opacity-80">
                  Batch ID: {uploadResponse.batch_id.substring(0, 8)}...
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-text-secondary">
              {!uploadResponse ? (
                <>
                  <p>• First column should contain URLs</p>
                  <p>• Excel files (.xlsx, .xls) up to 10MB</p>
                  {fileStatus === 'ready' && fileUrlCount > 0 && (
                    <p className="text-primary font-medium mt-1">Found {fileUrlCount} URLs</p>
                  )}
                </>
              ) : !isAnalyzing ? (
                <p>Click "Analyze" to start processing the URLs</p>
              ) : (
                <p>Analysis in progress...</p>
              )}
            </div>
            <div className="flex gap-2">
              {!uploadResponse ? (
                <Button
                  variant="primary"
                  onClick={handleUpload}
                  disabled={!selectedFile || fileStatus === 'uploading' || fileStatus === 'loading'}
                >
                  {fileStatus === 'uploading' ? (
                    <>
                      <Loader size={16} className="mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : fileStatus === 'loading' ? (
                    <>
                      <Loader size={16} className="mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Upload size={16} className="mr-2 group-hover:-translate-y-1 transition-transform" />
                      Upload File
                    </>
                  )}
                </Button>
              ) : !isAnalyzing ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={handleReset}
                    size="sm"
                  >
                    <X size={16} className="mr-1" />
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleStartAnalysis}
                    className="group"
                  >
                    <FileSpreadsheet size={16} className="mr-2 group-hover:scale-110 transition-transform" />
                    Analyze
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
    </div>
  );
};
