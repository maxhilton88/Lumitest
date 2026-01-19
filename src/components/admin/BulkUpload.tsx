import React, { useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { toast } from 'sonner';

interface BulkUploadProps {
  onClose: () => void;
  onImport: (questions: any[]) => void;
}

export const BulkUpload: React.FC<BulkUploadProps> = ({ onClose, onImport }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      if (ext !== 'xlsx' && ext !== 'csv') {
        setErrors(['Please upload an Excel (.xlsx) or CSV (.csv) file']);
        return;
      }
      setFile(selectedFile);
      setErrors([]);
    }
  };

  const validateImageUrl = async (url: string): Promise<boolean> => {
    if (!url) return true; // Optional field
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  };

  const downloadImage = async (url: string): Promise<string> => {
    // In a real implementation, this would download and store the image
    // For now, we'll just return the URL
    return url;
  };

  const parseCSV = (text: string): any[] => {
    // Improved CSV parser that handles quoted fields with commas
    const lines = text.trim().split('\n');
    if (lines.length < 2) return []; // Need at least header + 1 row
    
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            current += '"';
            i++; // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      // Add last field
      result.push(current.trim());
      return result;
    };
    
    const headers = parseCSVLine(lines[0]);
    const data: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      
      const values = parseCSVLine(lines[i]);
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      data.push(row);
    }
    
    return data;
  };

  const parseExcel = async (file: File): Promise<any[]> => {
    // Use SheetJS library to parse Excel files
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error('Failed to read file'));
            return;
          }
          
          // Import SheetJS dynamically
          const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
          
          // Parse the workbook
          const workbook = XLSX.read(data, { type: 'binary' });
          
          // Get first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          if (jsonData.length < 2) {
            resolve([]);
            return;
          }
          
          // Convert array of arrays to array of objects
          const headers = jsonData[0] as string[];
          const rows: any[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const values = jsonData[i] as any[];
            if (values.every(v => !v)) continue; // Skip empty rows
            
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index] !== undefined ? String(values[index]).trim() : '';
            });
            rows.push(row);
          }
          
          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const validateQuestion = async (row: any, rowIndex: number, type: string): Promise<{ valid: boolean; errors: string[] }> => {
    const rowErrors: string[] = [];

    // Common validations
    if (!row['Question (EN)']) rowErrors.push(`Row ${rowIndex}: Missing English question text`);
    if (!row['Age'] || ![4, 5, 6, 7].includes(Number(row['Age']))) {
      rowErrors.push(`Row ${rowIndex}: Age must be 4, 5, 6, or 7`);
    }
    if (!row['Quest']) rowErrors.push(`Row ${rowIndex}: Missing quest assignment`);

    // Type-specific validations
    if (type === 'mcq' || type === 'dragdrop') {
      if (!row['Option A (EN)']) rowErrors.push(`Row ${rowIndex}: Missing Option A text`);
      if (!row['Correct Answer'] || !['A', 'B', 'C', 'D'].includes(row['Correct Answer'])) {
        rowErrors.push(`Row ${rowIndex}: Correct Answer must be A, B, C, or D`);
      }

      // Validate image URLs if provided
      const imageUrls = ['Option A Image URL', 'Option B Image URL', 'Option C Image URL', 'Option D Image URL'];
      for (const urlField of imageUrls) {
        if (row[urlField]) {
          const isValid = await validateImageUrl(row[urlField]);
          if (!isValid) {
            rowErrors.push(`Row ${rowIndex}: Invalid or unreachable image URL in ${urlField}`);
          }
        }
      }
    }

    if (type === 'hotspot') {
      if (!row['Main Image URL']) rowErrors.push(`Row ${rowIndex}: Missing main image URL`);
      if (row['Main Image URL']) {
        const isValid = await validateImageUrl(row['Main Image URL']);
        if (!isValid) {
          rowErrors.push(`Row ${rowIndex}: Invalid or unreachable main image URL`);
        }
      }

      // Validate hotspot positions
      const areas = ['A', 'B', 'C', 'D'];
      for (const area of areas) {
        const x = Number(row[`Area ${area} X`]);
        const y = Number(row[`Area ${area} Y`]);
        if (isNaN(x) || x < 0 || x > 100) {
          rowErrors.push(`Row ${rowIndex}: Area ${area} X must be 0-100`);
        }
        if (isNaN(y) || y < 0 || y > 100) {
          rowErrors.push(`Row ${rowIndex}: Area ${area} Y must be 0-100`);
        }
      }
    }

    if (type === 'sequence') {
      if (!row['Item 1 (EN)']) rowErrors.push(`Row ${rowIndex}: Missing Item 1 text`);
      if (!row['Item 2 (EN)']) rowErrors.push(`Row ${rowIndex}: Missing Item 2 text`);
    }

    return { valid: rowErrors.length === 0, errors: rowErrors };
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setErrors([]);
    setSuccess(false);

    try {
      // Parse file
      let rows: any[] = [];
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'csv') {
        const text = await file.text();
        rows = parseCSV(text);
      } else if (ext === 'xlsx') {
        rows = await parseExcel(file);
      }

      // Check max limit
      if (rows.length > 100) {
        setErrors(['Maximum 100 questions allowed per upload. Please split into multiple files.']);
        setUploading(false);
        return;
      }

      // Detect question type from first row or filename
      const questionType = 'mcq'; // Simplified - would detect from sheet name or file

      // Validate all rows
      const allErrors: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        setProgress(((i + 1) / rows.length) * 50); // First 50% for validation
        const validation = await validateQuestion(rows[i], i + 2, questionType); // +2 for header row
        if (!validation.valid) {
          allErrors.push(...validation.errors);
        }
      }

      // If any errors, reject entire file
      if (allErrors.length > 0) {
        setErrors(allErrors);
        setUploading(false);
        return;
      }

      // Download images
      const questions = [];
      for (let i = 0; i < rows.length; i++) {
        setProgress(50 + ((i + 1) / rows.length) * 50); // Last 50% for image download
        
        const row = rows[i];
        const question: any = {
          id: `bulk-${Date.now()}-${i}`,
          type: questionType,
          question: {
            en: row['Question (EN)'],
            ms: row['Question (BM)'] || row['Question (EN)'],
            zh: row['Question (ZH)'] || row['Question (EN)']
          },
          language: row['Language'] || 'global',
          ageDifficulty: Number(row['Age']),
          quest: row['Quest'],
          skills: row['Skills'] ? row['Skills'].split(';').map((s: string) => s.trim()) : [],
          tags: row['Tags'] ? row['Tags'].split(';').map((t: string) => t.trim()) : [],
          createdAt: new Date().toISOString().split('T')[0]
        };

        // Download and attach images
        if (questionType === 'mcq' || questionType === 'dragdrop') {
          question.options = [];
          for (const option of ['A', 'B', 'C', 'D']) {
            const imageUrl = row[`Option ${option} Image URL`];
            question.options.push({
              id: option.toLowerCase(),
              text: {
                en: row[`Option ${option} (EN)`] || '',
                ms: row[`Option ${option} (BM)`] || row[`Option ${option} (EN)`] || '',
                zh: row[`Option ${option} (ZH)`] || row[`Option ${option} (EN)`] || ''
              },
              image: imageUrl ? await downloadImage(imageUrl) : ''
            });
          }
          question.correctAnswer = row['Correct Answer'].toLowerCase();
        }

        if (questionType === 'hotspot') {
          question.hotspotImage = await downloadImage(row['Main Image URL']);
          question.hotspotAreas = [];
          for (const area of ['A', 'B', 'C', 'D']) {
            question.hotspotAreas.push({
              id: area.toLowerCase(),
              position: {
                x: Number(row[`Area ${area} X`]),
                y: Number(row[`Area ${area} Y`]),
                width: Number(row[`Area ${area} Width`]) || 15,
                height: Number(row[`Area ${area} Height`]) || 15
              }
            });
          }
          question.correctAnswer = row['Correct Answer'].toLowerCase();
        }

        if (questionType === 'sequence') {
          question.options = [];
          for (let j = 1; j <= 4; j++) {
            const imageUrl = row[`Item ${j} Image URL`];
            question.options.push({
              id: String.fromCharCode(96 + j), // a, b, c, d
              text: {
                en: row[`Item ${j} (EN)`] || '',
                ms: row[`Item ${j} (BM)`] || row[`Item ${j} (EN)`] || '',
                zh: row[`Item ${j} (ZH)`] || row[`Item ${j} (EN)`] || ''
              },
              image: imageUrl ? await downloadImage(imageUrl) : ''
            });
          }
          question.correctAnswer = 'a,b,c,d'; // Sequence is always in order
        }

        questions.push(question);
      }

      setProgress(100);
      setSuccess(true);
      
      // Import questions
      setTimeout(() => {
        onImport(questions);
        onClose();
      }, 1500);

    } catch (error) {
      setErrors([`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bulk Upload Questions</h2>
            <p className="text-sm text-gray-500 mt-1">Upload up to 100 questions at once</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload File (Excel or CSV)
            </label>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              disabled={uploading}
            />
            {file && (
              <p className="text-sm text-gray-600 mt-2">
                Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {/* Progress Bar */}
          {uploading && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Processing...</span>
                <span className="text-sm font-medium text-gray-900">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-black transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">Upload Successful!</p>
                <p className="text-sm text-green-700 mt-1">Questions are being imported...</p>
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-900">Upload Failed</p>
              </div>
              <div className="ml-8 space-y-1 max-h-40 overflow-y-auto">
                {errors.map((error, i) => (
                  <p key={i} className="text-sm text-red-700">• {error}</p>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="font-medium text-gray-900 mb-2">📋 Instructions:</p>
            <ul className="space-y-1 text-gray-600">
              <li>1. Download the template below</li>
              <li>2. Fill in your questions (max 100 per file)</li>
              <li>3. For images, provide valid image URLs</li>
              <li>4. Upload the completed file</li>
              <li>5. All rows must be valid or upload will fail</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading || success}
            className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload Questions'}
          </button>
        </div>
      </div>
    </div>
  );
};