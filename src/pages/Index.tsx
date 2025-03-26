
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, Server } from 'lucide-react';
import { API_BASE_URL } from '@/utils/api/core';

const Index = () => {
  const [apiStatus, setApiStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [apiMessage, setApiMessage] = useState<string>('');
  
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        console.log('Checking API status...');
        const response = await fetch(`${API_BASE_URL.split('/api')[0]}/api/health`);
        
        if (response.ok) {
          const data = await response.json();
          setApiStatus('online');
          setApiMessage(data.message || 'API is online');
          console.log('API is online:', data);
        } else {
          setApiStatus('offline');
          setApiMessage(`Error ${response.status}: ${response.statusText}`);
          console.error('API status check failed:', response.statusText);
        }
      } catch (error) {
        console.error('Error checking API status:', error);
        setApiStatus('offline');
        setApiMessage('Could not connect to the API. Please ensure the backend server is running.');
      }
    };
    
    checkApiStatus();
  }, []);
  
  const handleRetryConnection = () => {
    setApiStatus('loading');
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Server className="h-6 w-6" />
            Data Validator App
          </CardTitle>
          <CardDescription>
            Validate and analyze your data with ease
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center p-4">
              <h2 className="text-xl font-semibold mb-2">Backend Connection Status</h2>
              
              {apiStatus === 'loading' ? (
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-2"></div>
                  <p>Checking connection to backend server...</p>
                </div>
              ) : apiStatus === 'online' ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <AlertTitle className="text-green-700">Connection Successful</AlertTitle>
                  <AlertDescription className="text-green-600">
                    Backend server is online and responding at {API_BASE_URL.split('/api')[0]}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="bg-red-50 border-red-200">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <AlertTitle className="text-red-700">Connection Failed</AlertTitle>
                  <AlertDescription className="text-red-600">
                    {apiMessage}
                    <div className="mt-2 text-sm">
                      API URL: {API_BASE_URL}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-sm text-muted-foreground mt-4">
                <strong>Connection details:</strong>
                <p>Backend API: {API_BASE_URL}</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          {apiStatus === 'offline' && (
            <Button 
              onClick={handleRetryConnection}
              className="w-full"
            >
              Retry Connection
            </Button>
          )}
          {apiStatus === 'online' && (
            <Button 
              asChild
              className="w-full"
            >
              <a href="/datasets">Get Started</a>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default Index;
