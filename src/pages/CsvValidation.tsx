
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, RefreshCw, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { CsvDataset, ValidationResult } from '@/types';
import { fetchCsvDatasetById } from '@/utils/api/csv';
import PageTransition from '@/components/ui/PageTransition';
import CsvValidationForm from '@/components/validation/CsvValidationForm';

const CsvValidation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [csvDataset, setCsvDataset] = useState<CsvDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  
  // Parse query params
  const queryParams = new URLSearchParams(location.search);
  const datasetId = queryParams.get('datasetId');
  
  useEffect(() => {
    if (!datasetId) {
      setError('No dataset ID provided');
      setLoading(false);
      return;
    }
    
    const loadDataset = async () => {
      setLoading(true);
      try {
        const response = await fetchCsvDatasetById(datasetId);
        if (response.success && response.data) {
          console.log('Loaded CSV dataset:', response.data);
          setCsvDataset(response.data);
        } else {
          console.error('Failed to load CSV dataset:', response.error);
          setError(response.error || 'Failed to load dataset details');
        }
      } catch (err) {
        console.error('Error loading CSV dataset:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    loadDataset();
  }, [datasetId]);
  
  const handleValidationComplete = (result: ValidationResult) => {
    console.log('Validation completed:', result);
    setValidationResult(result);
    
    // After validation is complete, navigate to results page
    setTimeout(() => {
      navigate('/results');
    }, 2000);
  };
  
  return (
    <PageTransition>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-1">CSV Validation</h1>
            <p className="text-muted-foreground">
              Create and run data quality validation checks on your CSV file
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/datasets')}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Datasets
            </Button>
          </div>
        </div>
        
        {validationResult && (
          <Alert
            className={
              validationResult.status === 'passed'
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }
          >
            <AlertTitle className="flex items-center gap-2">
              {validationResult.status === 'passed' ? 'Validation Passed' : 'Validation Failed'}
            </AlertTitle>
            <AlertDescription>
              {validationResult.status === 'passed' 
                ? 'Your CSV data passed all validation checks'
                : `Found ${validationResult.metrics.failedCount || 0} failures. Redirecting to the results page...`
              }
            </AlertDescription>
          </Alert>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2">Loading dataset...</span>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error}
              <div className="mt-2">
                <Button size="sm" variant="outline" asChild>
                  <a href="/datasets">Back to Datasets</a>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : csvDataset ? (
          <div className="space-y-6">
            <Alert variant="default" className="bg-muted">
              <FileSpreadsheet className="h-4 w-4" />
              <AlertTitle>{csvDataset.name}</AlertTitle>
              <AlertDescription>
                {csvDataset.fileName} • {csvDataset.rowCount.toLocaleString()} rows • {csvDataset.columns.length} columns
              </AlertDescription>
            </Alert>
            
            <CsvValidationForm 
              csvDataset={csvDataset}
              onValidationComplete={handleValidationComplete}
            />
          </div>
        ) : null}
      </div>
    </PageTransition>
  );
};

export default CsvValidation;
