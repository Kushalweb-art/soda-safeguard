
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Database, RefreshCw } from 'lucide-react';
import CsvUploader from '@/components/datasets/CsvUploader';
import PostgresConnectionForm from '@/components/datasets/PostgresConnection';
import DatasetList from '@/components/datasets/DatasetList';
import { CsvDataset, PostgresConnection } from '@/types';
import { fetchCsvDatasets, fetchPostgresConnections } from '@/utils/api';
import PageTransition from '@/components/ui/PageTransition';

const Datasets = () => {
  const [activeTab, setActiveTab] = useState<string>('connections');
  const [postgresConnections, setPostgresConnections] = useState<PostgresConnection[]>([]);
  const [csvDatasets, setCsvDatasets] = useState<CsvDataset[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
  
    try {
      const [connectionsResponse, datasetsResponse] = await Promise.all([
        fetchPostgresConnections(),
        fetchCsvDatasets(),
      ]);
  
      console.log("Fetched PostgreSQL Connections:", connectionsResponse);
      console.log("Fetched CSV Datasets:", datasetsResponse);
  
      setPostgresConnections(connectionsResponse.success ? connectionsResponse.data : []);
      setCsvDatasets(datasetsResponse.success ? datasetsResponse.data : []);
  
    } catch (error) {
      console.error("Error loading datasets:", error);
    }
  
    setLoading(false);
  };

  
  const handleConnectionCreated = (connection: PostgresConnection) => {
    setPostgresConnections(prev => [connection, ...prev]);
    setActiveTab('list');
  };
  
  const handleCsvUploaded = (dataset: CsvDataset) => {
    setCsvDatasets(prev => [dataset, ...prev]);
    setActiveTab('list');
  };
  
  return (
    <PageTransition>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-1">Datasets</h1>
            <p className="text-muted-foreground">
              Manage your data sources for validation
            </p>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            className="w-full md:w-auto"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid grid-cols-3 mb-8">
            <TabsTrigger value="list" className="gap-2">
              <div className="hidden sm:block">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              All Datasets
            </TabsTrigger>
            <TabsTrigger value="postgres" className="gap-2">
              <div className="hidden sm:block">
                <Database className="h-4 w-4" />
              </div>
              PostgreSQL
            </TabsTrigger>
            <TabsTrigger value="csv" className="gap-2">
              <div className="hidden sm:block">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              CSV Upload
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="list" className="mt-0">
            <DatasetList
              postgresConnections={postgresConnections}
              csvDatasets={csvDatasets}
            />
          </TabsContent>
          
          <TabsContent value="postgres" className="mt-0">
            <PostgresConnectionForm onConnectionCreated={handleConnectionCreated} />
          </TabsContent>
          
          <TabsContent value="csv" className="mt-0">
            <CsvUploader onUploadComplete={handleCsvUploaded} />
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
};

export default Datasets;
