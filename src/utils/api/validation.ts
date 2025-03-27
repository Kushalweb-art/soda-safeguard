
import { ApiResponse, ValidationCheck, ValidationResult } from '@/types';
import { fetchApi, handleError, API_BASE_URL } from './core';

export const fetchValidationChecks = async (): Promise<ApiResponse<ValidationCheck[]>> => {
  return fetchApi<ValidationCheck[]>('/validation/checks');
};

export const createValidationCheck = async (check: Omit<ValidationCheck, 'id' | 'createdAt'>): Promise<ApiResponse<ValidationCheck>> => {
  return fetchApi<ValidationCheck>('/validation/checks', {
    method: 'POST',
    body: JSON.stringify(check),
  });
};

export const runValidation = async (checkId: string): Promise<ApiResponse<ValidationResult>> => {
  try {
    console.log(`Starting validation run for check ID: ${checkId}`);
    
    // Start the validation in the background
    const startResponse = await fetchApi<any>(`/validation/run/${checkId}`, {
      method: 'POST',
    });
    
    if (!startResponse.success) {
      console.error('Failed to start validation:', startResponse.error);
      return startResponse;
    }
    
    console.log('Validation started successfully, fetching results...');
    
    // Wait a moment for the validation to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get the latest validation results
    const resultsResponse = await fetchApi<ValidationResult[]>('/validation/results');
    
    if (!resultsResponse.success || !resultsResponse.data) {
      console.error('Failed to fetch validation results:', resultsResponse.error);
      return {
        success: false,
        error: resultsResponse.error || 'Failed to fetch validation results',
      };
    }
    
    console.log('Received validation results:', resultsResponse.data);
    
    // Find the result for this check - get the most recent one with matching checkId
    const result = resultsResponse.data
      .filter(r => r.checkId === checkId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    if (!result) {
      console.error(`No validation result found for check ID: ${checkId}`);
      return {
        success: false,
        error: 'Validation result not found',
      };
    }
    
    console.log('Found matching validation result:', result);
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Error during validation process:', error);
    return handleError(error);
  }
};

export const fetchValidationResults = async (): Promise<ApiResponse<ValidationResult[]>> => {
  return fetchApi<ValidationResult[]>('/validation/results');
};

// Get validation check types that are available for a specific dataset type
export const getAvailableCheckTypes = (datasetType: 'postgres' | 'csv') => {
  // Common check types for both dataset types
  const commonChecks = [
    { value: 'missing_values', label: 'Missing Values', description: 'Check for null or empty values in a column' },
    { value: 'unique_values', label: 'Unique Values', description: 'Ensure all values in a column are unique' },
    { value: 'valid_values', label: 'Valid Values', description: 'Check if values match a predefined set' },
  ];
  
  // CSV-specific checks
  const csvChecks = [
    { value: 'value_range', label: 'Value Range', description: 'Verify numeric values are within a range' },
    { value: 'regex_match', label: 'Regex Match', description: 'Validate text format with a regular expression' },
  ];
  
  // PostgreSQL-specific checks
  const postgresChecks = [
    ...csvChecks,
    { value: 'schema', label: 'Schema Validation', description: 'Verify the data structure matches expected schema' },
    { value: 'custom_sql', label: 'Custom SQL', description: 'Write a custom SQL query for validation' },
  ];
  
  return datasetType === 'postgres' ? [...commonChecks, ...postgresChecks] : [...commonChecks, ...csvChecks];
};
