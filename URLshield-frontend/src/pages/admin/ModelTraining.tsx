import React, { useState, useRef, useEffect } from 'react';
import { Upload, Settings2, BarChart3, AlertCircle, CheckCircle2, Loader, FileSpreadsheet, ChevronRight, Database, Download, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardHeader, CardContent } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { apiClient } from '../../lib/api';
import type { TrainingResponse } from '../../types/api';

export const ModelTraining: React.FC = () => {
  // Step 1: Feature Extraction
  const [extractionFile, setExtractionFile] = useState<File | null>(null);
  const [domainColumn, setDomainColumn] = useState('domain_name');
  const [legitimateColumn, setLegitimateColumn] = useState('Corresponding CSE Domain Name');
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractedFeaturesUrl, setExtractedFeaturesUrl] = useState<string | null>(null);
  const [extractedFeaturesFilename, setExtractedFeaturesFilename] = useState<string | null>(null);
  const [showDomainDropdown, setShowDomainDropdown] = useState(false);
  const [showLegitimateDropdown, setShowLegitimateDropdown] = useState(false);
  const extractionFileInputRef = useRef<HTMLInputElement | null>(null);
  const domainDropdownRef = useRef<HTMLDivElement | null>(null);
  const legitimateDropdownRef = useRef<HTMLDivElement | null>(null);

  // Step 2: Model Training
  const [trainingFile, setTrainingFile] = useState<File | null>(null);
  const [testSize, setTestSize] = useState('0.2');
  const [randomState, setRandomState] = useState('42');
  const [labelColumn, setLabelColumn] = useState('');
  const [modelFilename, setModelFilename] = useState('');
  const [isTraining, setIsTraining] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [result, setResult] = useState<TrainingResponse | null>(null);
  const [trainingColumns, setTrainingColumns] = useState<string[]>([]);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [dropColumns, setDropColumns] = useState<string[]>([]);
  const trainingFileInputRef = useRef<HTMLInputElement | null>(null);
  const labelDropdownRef = useRef<HTMLDivElement | null>(null);

  // File validation helper for both steps
  const validateExcelFile = (file: File): { valid: boolean; error?: string } => {
    const validExtensions = ['.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(ext)) {
      return {
        valid: false,
        error: 'Invalid file format. Please upload an Excel file (.xlsx or .xls).',
      };
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File too large. Maximum size is 50MB.',
      };
    }

    return { valid: true };
  };

  // Toggle a column in/out of the dropColumns list
  const toggleDropColumn = (column: string) => {
    setDropColumns(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (domainDropdownRef.current && !domainDropdownRef.current.contains(event.target as Node)) {
        setShowDomainDropdown(false);
      }
      if (legitimateDropdownRef.current && !legitimateDropdownRef.current.contains(event.target as Node)) {
        setShowLegitimateDropdown(false);
      }
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(event.target as Node)) {
        setShowLabelDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Parse Excel file to extract column names
  const parseExcelColumns = async (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get first worksheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Get headers (first row)
          const headers: string[] = [];
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
          
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
            if (cell && cell.v) {
              headers.push(String(cell.v));
            }
          }
          
          resolve(headers);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // Helper function to find the best domain column based on common naming patterns
  const findBestDomainColumn = (columns: string[]): string | null => {
    // Look for exact matches first (most specific to least specific)
    const exactMatches = [
      'domain_name',
      'domain',
      'url',
      'website',
      'domain name',
      'website url',
      'site url',
      'site',
      'link'
    ];
    
    // Try to find an exact match (case-insensitive)
    for (const match of exactMatches) {
      const found = columns.find(col => 
        col.toLowerCase() === match.toLowerCase()
      );
      if (found) return found;
    }

    // Try to find partial matches (most preferred to least preferred)
    const partialMatchKeywords = [
      'domain',
      'url',
      'site',
      'web',
      'link'
    ];

    for (const keyword of partialMatchKeywords) {
      const found = columns.find(col => 
        col.toLowerCase().includes(keyword.toLowerCase())
      );
      if (found) return found;
    }

    // If nothing found, return the first column or null
    return columns.length > 0 ? columns[0] : null;
  };

  // Helper function to find the legitimate domain column
  const findLegitimateColumn = (columns: string[]): string | null => {
    const keywords = [
      'corresponding',
      'legitimate',
      'original',
      'authentic',
      'real',
      'cse'
    ];

    // Look for columns containing any of these keywords
    for (const keyword of keywords) {
      const found = columns.find(col => 
        col.toLowerCase().includes(keyword.toLowerCase())
      );
      if (found) return found;
    }

    return null;
  };

  // Helper function to find the most likely label column
  const findLabelColumn = (columns: string[]): string | null => {
    const exactMatches = [
      'Phishing/Suspected Domains (i.e. Class Label)',
      'label',
      'class',
    ];

    for (const match of exactMatches) {
      const found = columns.find(col => col.toLowerCase() === match.toLowerCase());
      if (found) return found;
    }

    const keywords = ['label', 'class', 'phishing', 'suspected'];
    for (const keyword of keywords) {
      const found = columns.find(col => col.toLowerCase().includes(keyword.toLowerCase()));
      if (found) return found;
    }

    return null;
  };

  // Step 1: Feature Extraction handlers
  const handleExtractionFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const selected = files[0];
    const validation = validateExcelFile(selected);
    
    if (!validation.valid) {
      setExtractionError(validation.error ?? null);
      setExtractionFile(null);
      setAvailableColumns([]);
      return;
    }

    setExtractionFile(selected);
    setExtractionError(null);
    // Clear previous extraction result
    setExtractedFeaturesUrl(null);
    setExtractedFeaturesFilename(null);

    // Parse Excel to get column names
    try {
      const columns = await parseExcelColumns(selected);
      setAvailableColumns(columns);
      
      // Find best matches for domain and legitimate columns
      const bestDomainColumn = findBestDomainColumn(columns);
      const bestLegitimateColumn = findLegitimateColumn(columns);
      
      // Set values if found
      if (bestDomainColumn) {
        setDomainColumn(bestDomainColumn);
        console.log('Auto-detected domain column:', bestDomainColumn);
      }
      
      if (bestLegitimateColumn) {
        setLegitimateColumn(bestLegitimateColumn);
        console.log('Auto-detected legitimate column:', bestLegitimateColumn);
      } else {
        // If no legitimate column found, clear the field to avoid confusion
        setLegitimateColumn('');
      }
    } catch (error) {
      console.error('Error parsing Excel columns:', error);
      setExtractionError('Failed to parse Excel columns');
    }
  };

  const handleClearExtractionFile = () => {
    setExtractionFile(null);
    setExtractionError(null);
    setExtractedFeaturesUrl(null);
    setExtractedFeaturesFilename(null);
    if (extractionFileInputRef.current) {
      extractionFileInputRef.current.value = '';
    }
  };

  // Step 2: Model Training handlers
  const handleTrainingFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const selected = files[0];
    const validation = validateExcelFile(selected);
    
    if (!validation.valid) {
      setTrainingError(validation.error ?? null);
      setTrainingFile(null);
      setResult(null);
      setTrainingColumns([]);
      setLabelColumn('');
      return;
    }

    setTrainingFile(selected);
    setTrainingError(null);
    setResult(null);
    setTrainingColumns([]);
    setLabelColumn('');
    setDropColumns([]);

    try {
      const columns = await parseExcelColumns(selected);
      setTrainingColumns(columns);
      const bestLabelColumn = findLabelColumn(columns);
      if (bestLabelColumn) {
        setLabelColumn(bestLabelColumn);
      }
    } catch (error) {
      console.error('Error parsing training Excel columns:', error);
    }
  };

  const handleClearTrainingFile = () => {
    setTrainingFile(null);
    setTrainingError(null);
    setResult(null);
    setTrainingColumns([]);
    setLabelColumn('');
    if (trainingFileInputRef.current) {
      trainingFileInputRef.current.value = '';
    }
  };

  // Step 1: Feature Extraction
  const handleExtractFeatures = async () => {
    if (!extractionFile) {
      setExtractionError('Please select an Excel file containing URLs/domains.');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setExtractedFeaturesUrl(null);
    setExtractedFeaturesFilename(null);

    try {
      const blob = await apiClient.extractFeaturesFromExcel(extractionFile, {
        domainColumn: domainColumn.trim() || 'domain_name',
        legitimateColumn: legitimateColumn.trim() || undefined,
      });

      // Create a temporary URL for the blob
      const url = URL.createObjectURL(blob);
      setExtractedFeaturesUrl(url);
      setExtractedFeaturesFilename(`features_${extractionFile.name}`);
    } catch (err) {
      if (err instanceof Error) {
        setExtractionError(err.message);
      } else {
        setExtractionError('Feature extraction failed.');
      }
    } finally {
      setIsExtracting(false);
    }
  };

  // Automatically use the extracted features file for training
  const useExtractedFileForTraining = () => {
    if (extractedFeaturesUrl && extractedFeaturesFilename) {
      // Create a File object from the blob
      fetch(extractedFeaturesUrl)
        .then(res => res.blob())
        .then(async blob => {
          const file = new File([blob], extractedFeaturesFilename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          setTrainingFile(file);
          setTrainingError(null);
          setResult(null);
          setTrainingColumns([]);
          setLabelColumn('');
          setDropColumns([]);

          try {
            const columns = await parseExcelColumns(file);
            setTrainingColumns(columns);
            const bestLabelColumn = findLabelColumn(columns);
            if (bestLabelColumn) {
              setLabelColumn(bestLabelColumn);
            }
          } catch (error) {
            console.error('Error parsing training Excel columns from extracted file:', error);
          }
        })
        .catch(err => {
          setTrainingError('Failed to use extracted file for training: ' + err.message);
        });
    }
  };

  // Step 2: Model Training
  const handleTrain = async () => {
    if (!trainingFile) {
      setTrainingError('Please select an Excel file with features to train the model.');
      return;
    }

    if (!labelColumn.trim()) {
      setTrainingError('Please select a label column.');
      return;
    }

    setIsTraining(true);
    setTrainingError(null);
    setResult(null);

    try {
      const response = await apiClient.trainModelFromExcel(trainingFile, {
        testSize,
        randomState,
        labelColumn: labelColumn.trim(),
        modelFilename: modelFilename.trim() || undefined,
        dropColumns,
      });

      if (!response.success) {
        setTrainingError(response.error || 'Training failed.');
      }

      setResult(response);
    } catch (err) {
      if (err instanceof Error) {
        setTrainingError(err.message);
      } else {
        setTrainingError('Training failed.');
      }
    } finally {
      setIsTraining(false);
    }
  };

  const formatAccuracy = (value?: number) => {
    if (typeof value !== 'number') {
      return 'N/A';
    }
    return `${(value * 100).toFixed(2)}%`;
  };

  const renderConfusionMatrix = (matrix?: number[][], mapping?: Record<string, string>) => {
    if (!matrix || matrix.length === 0) {
      return (
        <p className="text-sm text-text-secondary">Confusion matrix will appear here after training.</p>
      );
    }

    const labelEntries = mapping
      ? Object.entries(mapping).sort(([aKey], [bKey]) => Number(aKey) - Number(bKey))
      : [];

    const labels = labelEntries.map(([, value]) => value);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="border border-border px-2 py-1 text-left text-text-secondary">Actual \\ Predicted</th>
              {labels.map(label => (
                <th
                  key={label}
                  className="border border-border px-2 py-1 text-left text-text-secondary"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="border border-border px-2 py-1 text-text-secondary">
                  {labels[rowIndex] ?? rowIndex}
                </td>
                {row.map((value, colIndex) => (
                  <td
                    key={colIndex}
                    className="border border-border px-2 py-1 text-center text-text text-xs"
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text mb-2">Model Training</h1>
          <p className="text-text-secondary">
            Two-step process: 1) Extract features from URLs, then 2) Train model on extracted features.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <BarChart3 className="text-primary" size={20} />
          <span>
            Backend endpoint: <span className="text-text">/training/train-from-excel</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-1 space-y-4">
          {/* STEP 1: Feature Extraction */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text flex items-center gap-2">
                    <Database size={20} />
                    Step 1: Feature Extraction
                  </h2>
                  <p className="text-sm text-text-secondary mt-1">
                    Upload an Excel file with URLs to extract features.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">URL Excel file</label>
                <div className="flex items-center gap-3">
                  <input
                    ref={extractionFileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExtractionFileChange}
                    className="text-sm text-text-secondary file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:text-sm file:font-medium hover:file:bg-primary/20"
                  />
                  {extractionFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearExtractionFile}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {extractionFile && (
                  <p className="mt-1.5 text-xs text-text-secondary">
                    Selected: {extractionFile.name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Domain column</label>
                  <div className="relative" ref={domainDropdownRef}>
                    <div 
                      className="w-full flex items-center justify-between border border-border bg-surface px-3 py-2 rounded-lg text-text cursor-pointer hover:border-primary/40"
                      onClick={() => setShowDomainDropdown(!showDomainDropdown)}
                    >
                      <span>{domainColumn || 'Select domain column'}</span>
                      <ChevronDown size={16} />
                    </div>
                    {showDomainDropdown && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto bg-surface border border-border rounded-lg shadow-lg">
                        {availableColumns.length > 0 ? (
                          availableColumns.map((column, index) => (
                            <div 
                              key={`domain-${index}`}
                              className={`px-3 py-2 cursor-pointer hover:bg-primary/10 ${domainColumn === column ? 'bg-primary/10 text-primary font-medium' : 'text-text'}`}
                              onClick={() => {
                                setDomainColumn(column);
                                setShowDomainDropdown(false);
                              }}
                            >
                              {column}
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-text-secondary italic">No columns available</div>
                        )}
                      </div>
                    )}
                  </div>
                  {availableColumns.length === 0 && extractionFile && (
                    <p className="mt-1 text-xs text-text-secondary">Loading columns...</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">Legitimate column (optional)</label>
                  <div className="relative" ref={legitimateDropdownRef}>
                    <div 
                      className="w-full flex items-center justify-between border border-border bg-surface px-3 py-2 rounded-lg text-text cursor-pointer hover:border-primary/40"
                      onClick={() => setShowLegitimateDropdown(!showLegitimateDropdown)}
                    >
                      <span>{legitimateColumn ? legitimateColumn : 'None (Optional)'}</span>
                      <ChevronDown size={16} />
                    </div>
                    {showLegitimateDropdown && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto bg-surface border border-border rounded-lg shadow-lg">
                        <div 
                          className={`px-3 py-2 cursor-pointer hover:bg-primary/10 ${!legitimateColumn ? 'bg-primary/10 text-primary font-medium' : 'text-text'}`}
                          onClick={() => {
                            setLegitimateColumn('');
                            setShowLegitimateDropdown(false);
                          }}
                        >
                          None (Optional)
                        </div>
                        {availableColumns.length > 0 ? (
                          availableColumns.map((column, index) => (
                            <div 
                              key={`legitimate-${index}`}
                              className={`px-3 py-2 cursor-pointer hover:bg-primary/10 ${legitimateColumn === column ? 'bg-primary/10 text-primary font-medium' : 'text-text'}`}
                              onClick={() => {
                                setLegitimateColumn(column);
                                setShowLegitimateDropdown(false);
                              }}
                            >
                              {column}
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-text-secondary italic">No columns available</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {extractionError && (
                <div className="flex items-start gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{extractionError}</span>
                </div>
              )}

              {extractedFeaturesUrl && extractedFeaturesFilename && (
                <div className="flex items-start gap-2 p-3 bg-success/10 border border-success/20 rounded-lg text-success text-sm">
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col">
                    <span>Features extracted successfully!</span>
                    <div className="flex mt-2 gap-2">
                      <a
                        href={extractedFeaturesUrl}
                        download={extractedFeaturesFilename}
                        className="flex items-center gap-1 text-primary text-xs hover:underline"
                      >
                        <Download size={12} />
                        Download features file
                      </a>
                      <button
                        onClick={useExtractedFileForTraining}
                        className="flex items-center gap-1 text-primary text-xs hover:underline ml-2"
                      >
                        <ChevronRight size={12} />
                        Use for training
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleExtractFeatures}
                  disabled={isExtracting || !extractionFile}
                >
                  {isExtracting ? (
                    <>
                      <Loader size={16} className="mr-2 animate-spin" />
                      Extracting Features
                    </>
                  ) : (
                    <>
                      <Database size={16} className="mr-2" />
                      Extract Features
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* STEP 2: Model Training */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text flex items-center gap-2">
                    <FileSpreadsheet size={20} />
                    Step 2: Train Model
                  </h2>
                  <p className="text-sm text-text-secondary mt-1">
                    Use the features file to train an XGBoost model.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Features Excel file</label>
                <div className="flex items-center gap-3">
                  <input
                    ref={trainingFileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleTrainingFileChange}
                    className="text-sm text-text-secondary file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:text-sm file:font-medium hover:file:bg-primary/20"
                  />
                  {trainingFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearTrainingFile}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {trainingFile && (
                  <p className="mt-1.5 text-xs text-text-secondary">
                    Selected: {trainingFile.name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Test size"
                  placeholder="0.2"
                  value={testSize}
                  onChange={e => setTestSize(e.target.value)}
                />
                <Input
                  label="Random state"
                  placeholder="42"
                  value={randomState}
                  onChange={e => setRandomState(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Label column</label>
                <div className="relative" ref={labelDropdownRef}>
                  <div
                    className="w-full flex items-center justify-between border border-border bg-surface px-3 py-2 rounded-lg text-text cursor-pointer hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      if (!trainingFile || trainingColumns.length === 0) return;
                      setShowLabelDropdown(!showLabelDropdown);
                    }}
                  >
                    <span>
                      {labelColumn
                        ? labelColumn
                        : trainingFile
                          ? trainingColumns.length > 0
                            ? 'Select label column'
                            : 'Loading columns...'
                          : 'Select features file first'}
                    </span>
                    <ChevronDown size={16} />
                  </div>
                  {showLabelDropdown && (
                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto bg-surface border border-border rounded-lg shadow-lg">
                      {trainingColumns.length > 0 ? (
                        trainingColumns.map((column, index) => (
                          <div
                            key={`label-${index}`}
                            className={`px-3 py-2 cursor-pointer hover:bg-primary/10 ${labelColumn === column ? 'bg-primary/10 text-primary font-medium' : 'text-text'}`}
                            onClick={() => {
                              setLabelColumn(column);
                              setShowLabelDropdown(false);
                            }}
                          >
                            {column}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-text-secondary italic">No columns available</div>
                      )}
                    </div>
                  )}
                </div>
                {!labelColumn && trainingFile && (
                  <p className="mt-1 text-xs text-danger">
                    Please select a label column.
                  </p>
                )}
              </div>

              {/* Columns to drop from training */}
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">
                  Columns to exclude from training (optional)
                </label>
                {labelColumn && trainingColumns.length > 0 ? (
                  <div className="max-h-40 overflow-auto border border-border rounded-lg p-2 bg-surface text-xs">
                    {trainingColumns
                      .filter(col => col !== labelColumn)
                      .map((col) => {
                        const isDropped = dropColumns.includes(col);
                        return (
                          <button
                            key={col}
                            type="button"
                            onClick={() => toggleDropColumn(col)}
                            className={`mr-2 mb-2 inline-flex items-center rounded-full px-2.5 py-1 border text-[11px] transition-colors ${
                              isDropped
                                ? 'bg-danger/10 border-danger/40 text-danger'
                                : 'bg-surface border-border text-text-secondary hover:border-primary/40 hover:text-primary'
                            }`}
                          >
                            {isDropped && <span className="mr-1">✕</span>}
                            {col}
                          </button>
                        );
                      })}
                    {trainingColumns.filter(col => col !== labelColumn).length === 0 && (
                      <p className="text-text-secondary italic">No feature columns available.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary">
                    Select a features file and label column to see feature columns here.
                  </p>
                )}
                {dropColumns.length > 0 && (
                  <p className="mt-1 text-[11px] text-text-secondary">
                    Dropping {dropColumns.length} column{dropColumns.length > 1 ? 's' : ''} from training.
                  </p>
                )}
              </div>

              <Input
                label="Model filename (optional)"
                placeholder="xgboost_model_YYYYMMDD_HHMMSS.pkl"
                value={modelFilename}
                onChange={e => setModelFilename(e.target.value)}
              />

              {trainingError && (
                <div className="flex items-start gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{trainingError}</span>
                </div>
              )}

              {result && result.success && (
                <div className="flex items-start gap-2 p-3 bg-success/10 border border-success/20 rounded-lg text-success text-sm">
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                  <span>Training completed successfully.</span>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleTrain}
                  disabled={isTraining || !trainingFile || !labelColumn.trim()}
                >
                  {isTraining ? (
                    <>
                      <Loader size={16} className="mr-2 animate-spin" />
                      Training
                    </>
                  ) : (
                    <>
                      <Upload size={16} className="mr-2" />
                      Train Model
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-text flex items-center gap-2">
                <Settings2 size={18} />
                Tips
              </h2>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-text-secondary">
              <p><strong>Step 1:</strong> Upload an Excel file with domain URLs. The domain column should have URLs to analyze.</p>
              <p><strong>Step 2:</strong> Upload the features file (generated in step 1 or click "Use for training"), then select the label column (e.g. "Phishing/Suspected Domains (i.e. Class Label)").</p>
              <p>Trained models are saved in the backend under the models directory.</p>
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card hover>
              <CardHeader>
                <h3 className="text-sm font-semibold text-text">Accuracy</h3>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-text mb-1">
                  {formatAccuracy(result?.accuracy)}
                </p>
                <p className="text-xs text-text-secondary">
                  Fraction of correct predictions on the held-out test set.
                </p>
              </CardContent>
            </Card>

            <Card hover>
              <CardHeader>
                <h3 className="text-sm font-semibold text-text">Model artifact</h3>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-sm text-text">
                  {result?.model_filename || 'Not available yet'}
                </p>
                <p className="text-xs text-text-secondary">
                  Saved under backend models directory.
                </p>
                <p className="text-xs text-text-secondary mt-2">
                  Features: {result?.feature_columns ? result.feature_columns.length : 0}
                </p>
              </CardContent>
            </Card>

            <Card hover>
              <CardHeader>
                <h3 className="text-sm font-semibold text-text">Classes</h3>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-text-secondary">
                {result?.label_mapping ? (
                  Object.entries(result.label_mapping)
                    .sort(([aKey], [bKey]) => Number(aKey) - Number(bKey))
                    .map(([code, label]) => (
                      <p key={code} className="flex items-center justify-between">
                        <span className="text-text-secondary">Code {code}</span>
                        <span className="text-text font-medium">{label}</span>
                      </p>
                    ))
                ) : (
                  <p>No label mapping available yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-text">Confusion matrix</h3>
            </CardHeader>
            <CardContent>
              {renderConfusionMatrix(result?.confusion_matrix, result?.label_mapping)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-text">Classification report</h3>
            </CardHeader>
            <CardContent>
              {result?.classification_report ? (
                <pre className="text-xs whitespace-pre-wrap bg-bg rounded-lg p-3 border border-border overflow-x-auto">
                  {result.classification_report}
                </pre>
              ) : (
                <p className="text-sm text-text-secondary">
                  Classification metrics will appear here after training.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
