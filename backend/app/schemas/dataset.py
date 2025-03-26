
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

class CsvDatasetCreate(BaseModel):
    name: str
    fileName: str

class CsvDatasetResponse(BaseModel):
    id: str
    name: str
    fileName: str
    filePath: Optional[str] = None
    uploadedAt: str
    columns: List[str]
    rowCount: int
    previewData: List[Dict[str, Any]]

class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
