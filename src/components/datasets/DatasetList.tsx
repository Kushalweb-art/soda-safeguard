import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CsvDataset, PostgresConnection } from '@/types';
import { Database, FileSpreadsheet, Calendar, Table, ArrowRight, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface DatasetListProps {
  postgresConnections: PostgresConnection[];
  csvDatasets: CsvDataset[];
}

const DatasetList: React.FC<DatasetListProps> = ({ postgresConnections, csvDatasets }) => {
  const navigate = useNavigate();

  // Debugging: Log data in the console
  useEffect(() => {
    console.log("🟢 PostgreSQL Connections:", postgresConnections);
    console.log("🟢 CSV Datasets:", csvDatasets);
  }, [postgresConnections, csvDatasets]);

  const formatDate = (dateString: string) => format(new Date(dateString), 'MMM d, yyyy');

  return (
    <div className="space-y-6">
      {postgresConnections.length > 0 || csvDatasets.length > 0 ? (
        <>
          {postgresConnections.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                <Database className="h-5 w-5" />
                PostgreSQL Connections
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {postgresConnections.map((connection) => (
                  <motion.div
                    key={connection.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="h-full glass-panel glass-panel-hover overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">{connection.name}</CardTitle>
                            <CardDescription className="mt-1 text-xs">
                              {connection.host}:{connection.port}
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="text-xs font-normal">
                            PostgreSQL
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="text-sm text-muted-foreground mb-2">
                          <span className="font-medium text-foreground">Database:</span> {connection.database}
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground mt-2">
                          <Calendar className="h-3 w-3 mr-1" />
                          Added {formatDate(connection.createdAt)}
                        </div>
                        {connection.tables && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center text-xs font-medium mb-2">
                              <Table className="h-3 w-3 mr-1" />
                              Available Tables
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {connection.tables.slice(0, 3).map((table) => (
                                <span key={table.name} className="chip">{table.name}</span>
                              ))}
                              {connection.tables.length > 3 && (
                                <span className="chip">+{connection.tables.length - 3} more</span>
                              )}
                            </div>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary mt-3 p-0 h-auto"
                          onClick={() => navigate(`/validation?datasetId=${connection.id}&type=postgres`)}
                        >
                          Validate this data
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {csvDatasets.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                CSV Datasets
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {csvDatasets.map((dataset) => (
                  <motion.div
                    key={dataset.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="h-full glass-panel glass-panel-hover overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">{dataset.name}</CardTitle>
                            <CardDescription className="mt-1 text-xs">
                              {dataset.fileName}
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="text-xs font-normal">
                            CSV
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="text-sm text-muted-foreground mb-2">
                          <span className="font-medium text-foreground">{dataset.rowCount.toLocaleString()}</span> rows
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground mt-2">
                          <Calendar className="h-3 w-3 mr-1" />
                          Uploaded {formatDate(dataset.uploadedAt)}
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center text-xs font-medium mb-2">
                            <Table className="h-3 w-3 mr-1" />
                            Columns
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(dataset.columns) ? (
                              dataset.columns.slice(0, 3).map((column) => (
                                <span key={column} className="chip">{column}</span>
                              ))
                            ) : (
                              <span className="chip text-red-500">No columns available</span>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-3 mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary p-0 h-auto"
                            onClick={() => navigate(`/csv-validation?datasetId=${dataset.id}`)}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Validate CSV
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary p-0 h-auto"
                            onClick={() => navigate(`/validation?datasetId=${dataset.id}&type=csv`)}
                          >
                            Advanced Validation
                            <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <Card className="bg-muted/10 border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-xl font-medium mb-2">No datasets available</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Upload a CSV file or connect to a PostgreSQL database to get started with data validation.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DatasetList;
