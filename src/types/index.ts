
// Dataset Types
export interface PostgresConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  createdAt: string;
  tables?: PostgresTable[];
}

export interface PostgresTable {
  name: string;
  schema: string;
  columns: PostgresColumn[];
}

export interface PostgresColumn {
  name: string;
  dataType: string;
}

export interface CsvDataset {
  id: string;
  name: string;
  fileName: string;
  filePath?: string;
  uploadedAt: string;
  columns: string[];
  rowCount: number;
  previewData: any[];
}

export type Dataset = PostgresConnection | CsvDataset;

// Validation Types
export type ValidationCheckType = 
  | 'missing_values' 
  | 'unique_values' 
  | 'valid_values' 
  | 'value_range' 
  | 'regex_match' 
  | 'schema' 
  | 'custom_sql';

export interface ValidationCheck {
  id: string;
  name: string;
  type: ValidationCheckType;
  dataset: {
    id: string;
    name: string;
    type: 'postgres' | 'csv';
  };
  table?: string;
  column?: string;
  parameters: Record<string, any>;
  createdAt: string;
}

export interface ValidationResult {
  id: string;
  checkId: string;
  checkName: string;
  dataset: {
    id: string;
    name: string;
    type: 'postgres' | 'csv';
  };
  table?: string;
  column?: string;
  status: 'passed' | 'failed' | 'error';
  metrics: {
    rowCount?: number;
    passedCount?: number;
    failedCount?: number;
    erroredCount?: number;
    executionTimeMs?: number;
  };
  failedRows?: any[];
  errorMessage?: string;
  createdAt: string;
}

// Schema fetching types
export interface SchemaFetchParams {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface ApiSchemaResponse {
  success: boolean;
  tables?: PostgresTable[];
  error?: string;
  message?: string;
}

// Component Props
export interface SidebarLinkProps {
  to: string;
  icon: React.ComponentType<any>;
  label: string;
  active: boolean;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export interface PageProps {
  children: React.ReactNode;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
