
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  PlusCircle, 
  X, 
  Check, 
  AlertTriangle, 
  ArrowRight, 
  Database as DatabaseIcon, 
  FileSpreadsheet as FileSpreadsheetIcon 
} from 'lucide-react';
import { CsvDataset, PostgresConnection, ValidationCheck, ValidationCheckType, ValidationResult } from '@/types';
import { createValidationCheck, runValidation } from '@/utils/api';
import { motion, AnimatePresence } from 'framer-motion';

const checkTypeOptions = [
  { value: 'missing_values', label: 'Missing Values', description: 'Check for null or empty values in a column' },
  { value: 'unique_values', label: 'Unique Values', description: 'Ensure all values in a column are unique' },
  { value: 'valid_values', label: 'Valid Values', description: 'Check if values match a predefined set' },
  { value: 'value_range', label: 'Value Range', description: 'Verify numeric values are within a range' },
  { value: 'regex_match', label: 'Regex Match', description: 'Validate text format with a regular expression' },
  { value: 'schema', label: 'Schema Validation', description: 'Verify the data structure matches expected schema' },
  { value: 'custom_sql', label: 'Custom SQL', description: 'Write a custom SQL query for validation' },
];

const formSchema = z.object({
  name: z.string().min(1, 'Check name is required'),
  type: z.enum(['missing_values', 'unique_values', 'valid_values', 'value_range', 'regex_match', 'schema', 'custom_sql'] as const),
  datasetId: z.string().min(1, 'Dataset is required'),
  datasetType: z.enum(['postgres', 'csv']),
  table: z.string().optional(),
  column: z.string().optional(),
  parameters: z.record(z.any()),
});

type FormValues = z.infer<typeof formSchema>;

interface ValidationBuilderProps {
  postgresConnections: PostgresConnection[];
  csvDatasets: CsvDataset[];
  onValidationComplete: (result: ValidationResult) => void;
}

const ValidationBuilder: React.FC<ValidationBuilderProps> = ({
  postgresConnections,
  csvDatasets,
  onValidationComplete,
}) => {
  const { toast } = useToast();
  const [selectedCheckType, setSelectedCheckType] = useState<ValidationCheckType | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [selectedDatasetType, setSelectedDatasetType] = useState<'postgres' | 'csv' | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: 'missing_values',
      datasetId: '',
      datasetType: 'postgres',
      parameters: {},
    },
  });

  useEffect(() => {
    // Log connections for debugging
    console.log("ValidationBuilder received PostgreSQL connections:", postgresConnections);
    if (postgresConnections.length > 0) {
      postgresConnections.forEach((conn, index) => {
        console.log(`Connection ${index + 1} (${conn.name}) tables:`, conn.tables);
      });
    }
  }, [postgresConnections]);

  const getSelectedDataset = () => {
    if (!selectedDatasetId || !selectedDatasetType) return null;
    
    if (selectedDatasetType === 'postgres') {
      const pgConn = postgresConnections.find(conn => conn.id === selectedDatasetId);
      console.log("Selected PostgreSQL connection:", pgConn);
      return pgConn;
    } else {
      return csvDatasets.find(dataset => dataset.id === selectedDatasetId);
    }
  };
  
  const getAvailableColumns = () => {
    const dataset = getSelectedDataset();
    if (!dataset) return [];
    
    if (selectedDatasetType === 'postgres') {
      const pgDataset = dataset as PostgresConnection;
      console.log("Looking for table:", selectedTable, "in tables:", pgDataset.tables);
      const table = pgDataset.tables?.find(t => t.name === selectedTable);
      console.log("Found table:", table);
      return table?.columns || [];
    } else {
      const csvDataset = dataset as CsvDataset;
      return csvDataset.columns.map(col => ({ name: col, dataType: 'string' }));
    }
  };
  
  const handleDatasetChange = (datasetId: string, type: 'postgres' | 'csv') => {
    setSelectedDatasetId(datasetId);
    setSelectedDatasetType(type);
    setSelectedTable(null);
    
    form.setValue('datasetId', datasetId);
    form.setValue('datasetType', type);
    form.setValue('table', undefined);
    form.setValue('column', undefined);
    
    // Log the selected dataset for debugging
    console.log("Selected dataset:", type, datasetId);
    
    // Get selected dataset details
    const dataset = type === 'postgres' 
      ? postgresConnections.find(conn => conn.id === datasetId)
      : csvDatasets.find(ds => ds.id === datasetId);
      
    console.log("Dataset details:", dataset);
    if (type === 'postgres') {
      console.log("Tables in selected PostgreSQL connection:", (dataset as PostgresConnection)?.tables);
    }
  };
  
  const handleCheckTypeChange = (type: ValidationCheckType) => {
    setSelectedCheckType(type);
    form.setValue('type', type as never);  // Type assertion to handle the type issue
    
    let defaultParams = {};
    switch (type) {
      case 'missing_values':
        defaultParams = { threshold: 0 };
        break;
      case 'unique_values':
        defaultParams = {};
        break;
      case 'valid_values':
        defaultParams = { values: [] };
        break;
      case 'value_range':
        defaultParams = { min: 0, max: 100 };
        break;
      case 'regex_match':
        defaultParams = { pattern: '' };
        break;
      case 'schema':
        defaultParams = { requiredColumns: [] };
        break;
      case 'custom_sql':
        defaultParams = { query: '' };
        break;
    }
    
    form.setValue('parameters', defaultParams);
  };
  
  const renderParametersForm = () => {
    const type = selectedCheckType;
    if (!type) return null;
    
    switch (type) {
      case 'missing_values':
        return (
          <FormField
            control={form.control}
            name="parameters.threshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Threshold (%)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    {...field}
                    onChange={e => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Maximum percentage of missing values allowed
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        );
        
      case 'valid_values':
        return (
          <FormField
            control={form.control}
            name="parameters.values"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valid Values (comma separated)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="value1, value2, value3"
                    {...field}
                    onChange={e => field.onChange(e.target.value.split(',').map(s => s.trim()))}
                    value={(field.value || []).join(', ')}
                  />
                </FormControl>
                <FormDescription>
                  List of values that are considered valid
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        );
        
      case 'value_range':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="parameters.min"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={e => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="parameters.max"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={e => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormDescription>
              The range of values that are considered valid
            </FormDescription>
          </>
        );
        
      case 'regex_match':
        return (
          <FormField
            control={form.control}
            name="parameters.pattern"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Regex Pattern</FormLabel>
                <FormControl>
                  <Input
                    placeholder="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Regular expression pattern to match against
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        );
        
      case 'custom_sql':
        return (
          <FormField
            control={form.control}
            name="parameters.query"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SQL Query</FormLabel>
                <FormControl>
                  <textarea
                    className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="SELECT * FROM table WHERE condition"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Custom SQL query to validate data
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        );
        
      default:
        return (
          <div className="text-center py-4 text-muted-foreground">
            No additional parameters needed for this check type
          </div>
        );
    }
  };
  
  const onSubmit = async (values: FormValues) => {
    setIsCreating(true);
    
    try {
      console.log("Submitting validation check:", values);
      
      let datasetName = '';
      if (values.datasetType === 'postgres') {
        const connection = postgresConnections.find(c => c.id === values.datasetId);
        datasetName = connection?.name || 'Unknown database';
        console.log("PostgreSQL connection selected:", connection);
      } else {
        const dataset = csvDatasets.find(d => d.id === values.datasetId);
        datasetName = dataset?.name || 'Unknown CSV';
      }
      
      const check: Omit<ValidationCheck, 'id' | 'createdAt'> = {
        name: values.name,
        type: values.type,
        dataset: {
          id: values.datasetId,
          name: datasetName,
          type: values.datasetType,
        },
        table: values.table,
        column: values.column,
        parameters: values.parameters,
      };
      
      console.log("Creating validation check:", check);
      const response = await createValidationCheck(check);
      
      if (response.success && response.data) {
        toast({
          title: 'Validation check created',
          description: 'The check has been created successfully',
        });
        
        setIsCreating(false);
        setIsRunning(true);
        
        console.log("Running validation for check ID:", response.data.id);
        const validationResponse = await runValidation(response.data.id);
        console.log("Validation result:", validationResponse);
        
        if (validationResponse.success && validationResponse.data) {
          toast({
            title: 'Validation completed',
            description: `The check ${validationResponse.data.status === 'passed' ? 'passed' : 'failed'}`,
            variant: validationResponse.data.status === 'passed' ? 'default' : 'destructive',
          });
          
          onValidationComplete(validationResponse.data);
        }
      }
    } catch (error) {
      console.error("Error in validation:", error);
      toast({
        title: 'Error creating validation check',
        description: 'There was a problem creating the validation check',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
      setIsRunning(false);
    }
  };
  
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Create Validation Check
        </CardTitle>
        <CardDescription>
          Define data quality rules to validate your datasets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Check Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Email Format Validation" {...field} />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for this validation check
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Select Dataset</h3>
              
              <Tabs defaultValue="postgres" className="w-full">
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="postgres">PostgreSQL</TabsTrigger>
                  <TabsTrigger value="csv">CSV Files</TabsTrigger>
                </TabsList>
                
                <TabsContent value="postgres" className="mt-0 space-y-4">
                  {postgresConnections.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {postgresConnections.map(connection => (
                        <div
                          key={connection.id}
                          className={`
                            p-3 rounded-md border cursor-pointer transition-all
                            ${selectedDatasetId === connection.id && selectedDatasetType === 'postgres'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 hover:bg-muted/10'
                            }
                          `}
                          onClick={() => handleDatasetChange(connection.id, 'postgres')}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-sm">{connection.name}</h4>
                              <p className="text-xs text-muted-foreground">{connection.host}:{connection.port}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {connection.tables && connection.tables.length 
                                  ? `${connection.tables.length} tables available` 
                                  : 'No tables available'}
                              </p>
                            </div>
                            {selectedDatasetId === connection.id && selectedDatasetType === 'postgres' && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <DatabaseIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <h3 className="text-sm font-medium mb-1">No PostgreSQL connections</h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Add a connection to get started
                      </p>
                      <Button size="sm" variant="outline" asChild>
                        <a href="/datasets?tab=postgres">Add Connection</a>
                      </Button>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="csv" className="mt-0 space-y-4">
                  {csvDatasets.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {csvDatasets.map(dataset => (
                        <div
                          key={dataset.id}
                          className={`
                            p-3 rounded-md border cursor-pointer transition-all
                            ${selectedDatasetId === dataset.id && selectedDatasetType === 'csv'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 hover:bg-muted/10'
                            }
                          `}
                          onClick={() => handleDatasetChange(dataset.id, 'csv')}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-sm">{dataset.name}</h4>
                              <p className="text-xs text-muted-foreground">{dataset.rowCount.toLocaleString()} rows</p>
                            </div>
                            {selectedDatasetId === dataset.id && selectedDatasetType === 'csv' && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <FileSpreadsheetIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <h3 className="text-sm font-medium mb-1">No CSV datasets</h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Upload a CSV file to get started
                      </p>
                      <Button size="sm" variant="outline" asChild>
                        <a href="/datasets?tab=csv">Upload CSV</a>
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
            
            {selectedDatasetId && selectedDatasetType && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <Separator className="my-4" />
                  
                  {selectedDatasetType === 'postgres' && (
                    <FormField
                      control={form.control}
                      name="table"
                      render={({ field }) => {
                        const selectedConn = postgresConnections.find(conn => conn.id === selectedDatasetId);
                        console.log("Table selection - connection:", selectedConn?.name);
                        console.log("Table selection - available tables:", selectedConn?.tables);
                        
                        return (
                          <FormItem>
                            <FormLabel>Table</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                setSelectedTable(value);
                                console.log("Selected table:", value);
                              }}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select table" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {selectedConn && selectedConn.tables && selectedConn.tables.length > 0 ? (
                                  selectedConn.tables.map(table => (
                                    <SelectItem key={table.name} value={table.name}>
                                      {table.name}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="no_tables" disabled>
                                    No tables available
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              {selectedConn && selectedConn.tables && selectedConn.tables.length > 0
                                ? 'Select the table to validate'
                                : 'No tables available in this connection'}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  )}
                  
                  <FormField
                    control={form.control}
                    name="column"
                    render={({ field }) => {
                      const availableColumns = getAvailableColumns();
                      console.log("Column selection - available columns:", availableColumns);
                      
                      return (
                        <FormItem>
                          <FormLabel>Column</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              console.log("Selected column:", value);
                            }}
                            value={field.value}
                            disabled={selectedDatasetType === 'postgres' && !selectedTable}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select column" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableColumns.length > 0 ? (
                                availableColumns.map(column => (
                                  <SelectItem key={column.name} value={column.name}>
                                    {column.name} ({column.dataType})
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="no_columns" disabled>
                                  {selectedDatasetType === 'postgres' && !selectedTable 
                                    ? 'Select a table first'
                                    : 'No columns available'}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {selectedDatasetType === 'postgres' && !selectedTable 
                              ? 'Please select a table first'
                              : availableColumns.length > 0
                                ? 'Select the column to validate'
                                : 'No columns available'}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Select Check Type</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {checkTypeOptions.map(option => (
                        <div
                          key={option.value}
                          className={`
                            p-3 rounded-md border cursor-pointer transition-all
                            ${selectedCheckType === option.value
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 hover:bg-muted/10'
                            }
                          `}
                          onClick={() => handleCheckTypeChange(option.value as ValidationCheckType)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-sm">{option.label}</h4>
                              <p className="text-xs text-muted-foreground">{option.description}</p>
                            </div>
                            {selectedCheckType === option.value && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {selectedCheckType && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 pt-4"
                    >
                      <Separator className="my-4" />
                      
                      <h3 className="text-sm font-medium">Check Parameters</h3>
                      
                      {renderParametersForm()}
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
            
            <div className="pt-4 flex justify-end">
              <Button
                type="submit"
                disabled={isCreating || isRunning}
                className="min-w-[120px]"
              >
                {isCreating
                  ? 'Creating...'
                  : isRunning
                    ? 'Running...'
                    : 'Create & Run'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ValidationBuilder;
