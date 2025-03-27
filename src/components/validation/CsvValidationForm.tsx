
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { CsvDataset, ValidationCheck, ValidationCheckType, ValidationResult } from '@/types';
import { createValidationCheck, runValidation, getAvailableCheckTypes } from '@/utils/api/validation';
import { fetchCsvDatasetById } from '@/utils/api/csv';

const formSchema = z.object({
  name: z.string().min(1, 'Check name is required'),
  type: z.enum(['missing_values', 'unique_values', 'valid_values', 'value_range', 'regex_match'] as const),
  column: z.string().min(1, 'Column is required'),
  parameters: z.record(z.any()),
});

type FormValues = z.infer<typeof formSchema>;

interface CsvValidationFormProps {
  csvDataset: CsvDataset;
  onValidationComplete: (result: ValidationResult) => void;
}

const CsvValidationForm: React.FC<CsvValidationFormProps> = ({
  csvDataset,
  onValidationComplete,
}) => {
  const { toast } = useToast();
  const [selectedCheckType, setSelectedCheckType] = useState<ValidationCheckType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dataset, setDataset] = useState<CsvDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get the available check types for CSV files
  const checkTypeOptions = getAvailableCheckTypes('csv');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: 'missing_values',
      column: '',
      parameters: {},
    },
  });

  useEffect(() => {
    // Fetch the full CSV dataset to get columns and other details
    const loadDataset = async () => {
      setIsLoading(true);
      try {
        const response = await fetchCsvDatasetById(csvDataset.id);
        if (response.success && response.data) {
          console.log("Loaded CSV dataset details:", response.data);
          setDataset(response.data);
        } else {
          console.error("Failed to load CSV dataset:", response.error);
          setError(response.error || "Failed to load dataset details");
        }
      } catch (err) {
        console.error("Error loading CSV dataset:", err);
        setError("An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    if (csvDataset?.id) {
      loadDataset();
    } else {
      setDataset(csvDataset);
      setIsLoading(false);
    }
  }, [csvDataset]);

  const handleCheckTypeChange = (type: ValidationCheckType) => {
    setSelectedCheckType(type);
    form.setValue('type', type as any);
    
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
      console.log("Submitting CSV validation check:", values);
      
      const check: Omit<ValidationCheck, 'id' | 'createdAt'> = {
        name: values.name,
        type: values.type,
        dataset: {
          id: csvDataset.id,
          name: csvDataset.name,
          type: 'csv',
        },
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
        } else {
          toast({
            title: 'Validation failed',
            description: validationResponse.error || 'There was a problem running the validation',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Error creating validation check',
          description: response.error || 'There was a problem creating the validation check',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error("Error in validation:", error);
      toast({
        title: 'Error creating validation check',
        description: error.message || 'There was a problem creating the validation check',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center items-center h-40">
            <div className="animate-pulse text-muted-foreground">Loading dataset details...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error loading dataset</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          CSV Validation Check
        </CardTitle>
        <CardDescription>
          Create a validation check for {csvDataset.name}
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
                    <Input placeholder="CSV Column Validation" {...field} />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for this validation check
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator className="my-4" />
            
            <FormField
              control={form.control}
              name="column"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Column</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {csvDataset.columns && csvDataset.columns.length > 0 ? (
                        csvDataset.columns.map(column => (
                          <SelectItem key={column} value={column}>
                            {column}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no_columns" disabled>
                          No columns available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the CSV column to validate
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
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
                        <CheckCircle className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {selectedCheckType && (
              <div className="space-y-4 pt-4">
                <Separator className="my-4" />
                
                <h3 className="text-sm font-medium">Check Parameters</h3>
                
                {renderParametersForm()}
              </div>
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

export default CsvValidationForm;
