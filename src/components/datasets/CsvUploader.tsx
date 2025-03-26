
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, Upload, X, Table, File, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadCsvFile } from '@/utils/api';
import { CsvDataset } from '@/types';
import { Progress } from '@/components/ui/progress';

interface CsvUploaderProps {
  onUploadComplete: (dataset: CsvDataset) => void;
}

const CsvUploader: React.FC<CsvUploaderProps> = ({ onUploadComplete }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };
  
  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file');
      toast({
        title: 'Invalid file type',
        description: 'Please select a CSV file',
        variant: 'destructive',
      });
      return;
    }
    
    // Check file size (limit to 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      toast({
        title: 'File too large',
        description: 'Please select a file smaller than 10MB',
        variant: 'destructive',
      });
      return;
    }
    
    setFile(selectedFile);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleCancelUpload = () => {
    setFile(null);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const simulateProgress = () => {
    // Simulate upload progress
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + Math.random() * 10;
        if (newProgress >= 95) {
          clearInterval(interval);
          return 95; // Wait for actual completion to set 100%
        }
        return newProgress;
      });
    }, 300);
    
    return () => clearInterval(interval);
  };
  
  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setError(null);
    
    // Start progress simulation
    const clearProgressInterval = simulateProgress();
    
    try {
      const response = await uploadCsvFile(file);
      
      // Clear the progress simulation
      clearProgressInterval();
      
      if (response.success && response.data) {
        setProgress(100);
        setTimeout(() => {
          toast({
            title: 'Upload successful',
            description: `${file.name} has been uploaded successfully`,
          });
          onUploadComplete(response.data);
        }, 500);
      } else {
        setError(response.error || 'Upload failed');
        toast({
          title: 'Upload failed',
          description: response.error || 'There was a problem uploading your file',
          variant: 'destructive',
        });
      }
    } catch (error) {
      clearProgressInterval();
      const errorMsg = (error as Error).message || 'There was a problem uploading your file';
      setError(errorMsg);
      toast({
        title: 'Upload failed',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Upload CSV
        </CardTitle>
        <CardDescription>
          Upload a CSV file to validate its data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8
            transition-all duration-200 ease-in-out
            flex flex-col items-center justify-center
            ${dragging ? 'border-primary bg-primary/5' : 'border-muted'}
            ${file ? 'bg-muted/10' : 'bg-muted/5 hover:bg-muted/10'}
            ${error ? 'border-red-500 bg-red-50/10' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-red-50 text-red-500 p-3 rounded-md mb-4 flex items-center w-full"
              >
                <AlertCircle className="h-5 w-5 mr-2" />
                <span>{error}</span>
              </motion.div>
            )}
            
            {file ? (
              <motion.div
                key="file-selected"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full flex flex-col items-center"
              >
                <div className="h-12 w-12 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                  <File className="h-6 w-6 text-primary" />
                </div>
                <p className="text-lg font-medium mb-1">{file.name}</p>
                <p className="text-muted-foreground text-sm mb-4">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                
                {uploading && (
                  <div className="w-full mb-4">
                    <Progress value={progress} className="h-2 mb-1" />
                    <p className="text-xs text-muted-foreground text-right">
                      {Math.round(progress)}%
                    </p>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleCancelUpload}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleUpload} 
                    disabled={uploading}
                    className={progress === 100 ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    {progress === 100 ? (
                      <>
                        <Check className="h-4 w-4 mr-1" /> Uploaded
                      </>
                    ) : uploading ? (
                      'Uploading...'
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-1" /> Upload
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="file-upload"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="w-full text-center"
              >
                <div className="h-12 w-12 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Drag and drop your CSV file</h3>
                <p className="text-muted-foreground mb-4">
                  or click the button below to browse files
                </p>
                <Button onClick={handleUploadClick} variant="secondary">
                  Select CSV file
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start pt-0">
        <div className="text-sm text-muted-foreground mt-2">
          <ul className="list-disc ml-5 space-y-1">
            <li>File must be in CSV format</li>
            <li>Maximum file size: 10MB</li>
            <li>Make sure the CSV has a header row</li>
          </ul>
        </div>
      </CardFooter>
    </Card>
  );
};

export default CsvUploader;
