
import { ApiResponse, CsvDataset } from '@/types';
import { fetchApi, handleError, API_BASE_URL } from './core';
import { toast } from '@/hooks/use-toast';

export const fetchCsvDatasets = async (): Promise<ApiResponse<CsvDataset[]>> => {
  try {
    console.log('Fetching CSV datasets...');
    return await fetchApi<CsvDataset[]>('/datasets/csv');
  } catch (error) {
    console.error('Error fetching CSV datasets:', error);
    return handleError(error);
  }
};

export const uploadCsvFile = async (file: File): Promise<ApiResponse<CsvDataset>> => {
  try {
    console.log(`Uploading CSV file: ${file.name} (${file.size} bytes)`);
    
    const formData = new FormData();
    formData.append('file', file);
    
    const url = `${API_BASE_URL}/datasets/csv/upload`;
    console.log(`Making upload request to: ${url}`);
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for uploads
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include',
      signal: controller.signal,
    });
    
    // Clear timeout
    clearTimeout(timeoutId);
    
    console.log('Upload response status:', response.status);
    
    if (!response.ok) {
      let errorMessage = `Upload error (${response.status}): ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        console.error('Could not parse error response:', e);
      }
      
      console.error(errorMessage);
      toast({
        title: 'Upload Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return {
        success: false,
        error: errorMessage,
      };
    }
    
    const data = await response.json();
    console.log('CSV upload successful, response:', data);
    
    toast({
      title: 'Upload Successful',
      description: `File ${file.name} was uploaded successfully.`,
      variant: 'default',
    });
    
    return data;
  } catch (error: any) {
    // Check if the error is an AbortError (timeout)
    if (error.name === 'AbortError') {
      const errorMessage = 'Upload timed out. The file may be too large or the server is busy.';
      console.error(errorMessage);
      toast({
        title: 'Upload Timeout',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return {
        success: false,
        error: errorMessage,
      };
    }
    
    console.error('CSV upload failed:', error);
    return handleError(error);
  }
};

export const fetchCsvDatasetData = async (
  datasetId: string,
  limit: number = 100,
  offset: number = 0
): Promise<ApiResponse<{rows: any[], totalRows: number, columns: string[]}>> => {
  try {
    console.log(`Fetching CSV dataset data for ID: ${datasetId}, limit: ${limit}, offset: ${offset}`);
    return await fetchApi<{rows: any[], totalRows: number, columns: string[]}>(`/datasets/csv/${datasetId}/data?limit=${limit}&offset=${offset}`);
  } catch (error) {
    console.error('Error fetching CSV dataset data:', error);
    return handleError(error);
  }
};
