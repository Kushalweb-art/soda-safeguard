
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, Upload, X, Table, File } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadCsvFile } from '@/utils/api';
import { CsvDataset } from '@/types';

interface CsvUploaderProps {
  onUploadComplete: (dataset: CsvDataset) => void;
}

const CsvUploader: React.FC<CsvUploaderProps> = ({ onUploadComplete }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };
  
  const validateAndSetFile = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a CSV file',
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    try {
      const response = await uploadCsvFile(file);
      if (response.success && response.data) {
        toast({
          title: 'Upload successful',
          description: `${file.name} has been uploaded`,
        });
        onUploadComplete(response.data);
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'There was a problem uploading your file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setFile(null);
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
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="outline" onClick={handleCancelUpload}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={handleUpload} disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Upload'}
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
    </Card>
  );
};

export default CsvUploader;
