
import { ApiResponse } from '@/types';
import { toast } from '@/hooks/use-toast';

// API base URL - ensure this matches your backend server
export const API_BASE_URL = 'http://127.0.0.1:8000/api';

// Helper function to simulate API latency in development for smoother UX
export const simulateLatency = async () => {
  if (process.env.NODE_ENV === 'development') {
    const latency = 300 + Math.random() * 300; // Reduced latency for faster response
    return new Promise(resolve => setTimeout(resolve, latency));
  }
};

// Function to handle API errors consistently
export const handleError = (error: any): ApiResponse<never> => {
  const errorMessage = error?.message || 'An unexpected error occurred';
  console.error('API Error:', error);
  toast({
    title: 'Error',
    description: errorMessage,
    variant: 'destructive',
  });
  return {
    success: false,
    error: errorMessage,
  };
};

// Generic fetch function with improved error handling
export const fetchApi = async <T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  try {
    // Only simulate latency in development to prevent extra delays
    if (process.env.NODE_ENV === 'development') {
      await simulateLatency();
    }
    
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`Making API request to: ${url}`, {
      method: options.method || 'GET',
      headers: options.headers,
    });
    
    // Set default timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include credentials for cross-origin requests
      signal: controller.signal,
      ...options,
    });
    
    // Clear timeout
    clearTimeout(timeoutId);
    
    console.log(`Response status from ${endpoint}:`, response.status);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        console.error('Could not parse error response:', e);
        errorData = {};
      }
      
      const errorMessage = errorData.error || `Error: ${response.status} ${response.statusText}`;
      console.error(`API error (${response.status}):`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
    
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      console.warn(`Response is not JSON. Content-Type: ${contentType}`);
      data = { success: true };
    }
    
    console.log(`API response from ${endpoint}:`, data);
    
    return data;
  } catch (error: any) {
    // Check if the error is an AbortError (timeout)
    if (error.name === 'AbortError') {
      console.error(`Request to ${endpoint} timed out`);
      return {
        success: false,
        error: 'Request timed out. Please try again.',
      };
    }
    
    console.error(`API call to ${endpoint} failed:`, error);
    return handleError(error);
  }
};
