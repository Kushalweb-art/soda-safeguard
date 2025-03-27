
import { ApiResponse, CsvDataset } from '@/types';
import { fetchApi, simulateLatency, handleError, API_BASE_URL } from './core';

export const fetchCsvDatasets = async (): Promise<ApiResponse<CsvDataset[]>> => {
  return fetchApi<CsvDataset[]>('/datasets/csv');
};

export const fetchCsvDatasetById = async (id: string): Promise<ApiResponse<CsvDataset>> => {
  return fetchApi<CsvDataset>(`/datasets/csv/${id}`);
};

export const uploadCsvFile = async (file: File): Promise<ApiResponse<CsvDataset>> => {
  try {
    await simulateLatency();
    
    console.log(`Uploading CSV file: ${file.name} (${file.size} bytes)`);
    
    const formData = new FormData();
    formData.append('file', file);
    
    const url = `${API_BASE_URL}/datasets/csv/upload`;
    console.log(`Making upload request to: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      // Adding these headers explicitly to ensure proper CORS handling
      headers: {
        'Accept': 'application/json',
        // Don't set Content-Type with FormData as the browser will set it with the boundary
      },
      // Include credentials if your API requires them
      credentials: 'include',
    });
    
    if (!response.ok) {
      let errorMessage = `Upload error (${response.status}): ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        console.error('Could not parse error response:', e);
      }
      
      console.error(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
    
    const data = await response.json();
    console.log('CSV upload successful, response:', data);
    
    return data;
  } catch (error) {
    console.error('CSV upload failed:', error);
    return handleError(error);
  }
};

// Analyze a CSV dataset to get statistics and recommendations for validation
export const analyzeCsvDataset = async (datasetId: string): Promise<ApiResponse<any>> => {
  try {
    console.log(`Analyzing CSV dataset with ID: ${datasetId}`);
    const url = `${API_BASE_URL}/datasets/csv/${datasetId}/analyze`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorMessage = `Analysis error (${response.status}): ${response.statusText}`;
      console.error(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
    
    const data = await response.json();
    console.log('CSV analysis results:', data);
    
    return data;
  } catch (error) {
    console.error('CSV analysis failed:', error);
    return handleError(error);
  }
};
