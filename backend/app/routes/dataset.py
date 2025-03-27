
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List, Optional
from sqlalchemy.orm import Session
import uuid
from datetime import datetime
import pandas as pd
import csv
import json
import io
import os
import logging
from app.database import get_db
from app.models.dataset import CsvDataset
from app.schemas.dataset import (
    CsvDatasetCreate,
    CsvDatasetResponse,
    ApiResponse
)

# Set up logger
logger = logging.getLogger(__name__)

# Ensure upload directory exists
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
logger.info(f"Upload directory created/verified at: {os.path.abspath(UPLOAD_DIR)}")

def clean_json(data):
    """Recursively replace NaN and Infinity values in JSON."""
    if isinstance(data, dict):
        return {k: clean_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_json(v) for v in data]
    elif isinstance(data, float):
        if data == float("inf") or data == float("-inf") or pd.isna(data):
            return None
    return data

router = APIRouter()

@router.get("/csv", response_model=ApiResponse)
async def get_all_csv_datasets(db: Session = Depends(get_db)):
    """Get all CSV datasets"""
    datasets = db.query(CsvDataset).order_by(CsvDataset.uploaded_at.desc()).all()
    return {
        "success": True,
        "data": [clean_json(dataset.to_dict()) for dataset in datasets]
    }

@router.get("/csv/{dataset_id}", response_model=ApiResponse)
async def get_csv_dataset_by_id(dataset_id: str, db: Session = Depends(get_db)):
    """Get a CSV dataset by ID"""
    dataset = db.query(CsvDataset).filter(CsvDataset.id == dataset_id).first()
    if not dataset:
        return {
            "success": False,
            "error": "Dataset not found"
        }
    
    return {
        "success": True,
        "data": dataset.to_dict()
    }

@router.post("/csv/upload", response_model=ApiResponse)
async def upload_csv_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a CSV file and parse it"""
    try:
        if not file.filename.endswith('.csv'):
            return {
                "success": False,
                "error": "File must be a CSV"
            }
        
        # Read file content
        contents = await file.read()
        
        # Save file to disk
        file_id = f"csv_{uuid.uuid4()}"
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
        
        with open(file_path, "wb") as f:
            f.write(contents)
        
        # Parse CSV using pandas
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Get column names
        columns = df.columns.tolist()
        
        # Get row count
        row_count = len(df)
        
        # Convert non-serializable float values to None
        preview_data = df.head(3).replace({float("inf"): None, float("-inf"): None}).fillna(None).to_dict(orient='records')

        # Create dataset object
        new_dataset = CsvDataset(
            id=file_id,
            name=file.filename.replace('.csv', ''),
            file_name=file.filename,
            file_path=file_path,
            uploaded_at=datetime.now(),
            columns=columns,
            row_count=row_count,
            preview_data=preview_data
        )
        
        # Save to database
        db.add(new_dataset)
        db.commit()
        db.refresh(new_dataset)
        
        return {
            "success": True,
            "data": new_dataset.to_dict()
        }
    except Exception as e:
        logger.error(f"Error processing CSV file: {str(e)}")
        return {
            "success": False,
            "error": f"Error processing CSV file: {str(e)}"
        }

@router.post("/csv/{dataset_id}/analyze", response_model=ApiResponse)
async def analyze_csv_dataset(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """Analyze a CSV dataset to get statistics and recommendations for validation"""
    try:
        # Get the dataset from the database
        dataset = db.query(CsvDataset).filter(CsvDataset.id == dataset_id).first()
        if not dataset:
            return {
                "success": False,
                "error": "Dataset not found"
            }
        
        # Make sure the file exists
        if not os.path.exists(dataset.file_path):
            return {
                "success": False,
                "error": f"CSV file not found at: {dataset.file_path}"
            }
        
        # Read the CSV file
        df = pd.read_csv(dataset.file_path)
        
        # Analyze each column
        column_analysis = {}
        for column in dataset.columns:
            # Skip columns with object dtype for numeric analysis
            if df[column].dtype == 'object':
                unique_values = df[column].nunique()
                missing_values = df[column].isna().sum() + df[column].eq('').sum()
                
                column_analysis[column] = {
                    "dataType": "string",
                    "uniqueValues": int(unique_values),
                    "missingValues": int(missing_values),
                    "missingPercentage": float((missing_values / len(df)) * 100),
                    "sampleValues": df[column].dropna().sample(min(5, unique_values)).tolist() if unique_values > 0 else []
                }
            else:
                # For numeric columns
                try:
                    numeric_data = df[column].dropna()
                    missing_values = df[column].isna().sum()
                    
                    column_analysis[column] = {
                        "dataType": str(df[column].dtype),
                        "min": float(numeric_data.min()) if not numeric_data.empty else None,
                        "max": float(numeric_data.max()) if not numeric_data.empty else None,
                        "mean": float(numeric_data.mean()) if not numeric_data.empty else None,
                        "missingValues": int(missing_values),
                        "missingPercentage": float((missing_values / len(df)) * 100),
                        "uniqueValues": int(df[column].nunique())
                    }
                except:
                    # Fallback for columns that can't be analyzed numerically
                    column_analysis[column] = {
                        "dataType": str(df[column].dtype),
                        "uniqueValues": int(df[column].nunique()),
                        "missingValues": int(df[column].isna().sum()),
                        "missingPercentage": float((df[column].isna().sum() / len(df)) * 100)
                    }
        
        # Generate validation recommendations
        recommendations = []
        for column, analysis in column_analysis.items():
            # Missing values check
            if analysis.get("missingPercentage", 0) > 0:
                recommendations.append({
                    "type": "missing_values",
                    "column": column,
                    "message": f"Column '{column}' has {analysis['missingPercentage']:.1f}% missing values"
                })
            
            # Unique values check
            if analysis.get("uniqueValues", 0) == 1:
                recommendations.append({
                    "type": "unique_values",
                    "column": column,
                    "message": f"Column '{column}' has only one unique value"
                })
            
            # Range check for numeric columns
            if "min" in analysis and "max" in analysis:
                recommendations.append({
                    "type": "value_range",
                    "column": column,
                    "message": f"Column '{column}' has values between {analysis['min']} and {analysis['max']}"
                })
        
        return {
            "success": True,
            "data": {
                "columns": column_analysis,
                "recommendations": recommendations
            }
        }
    except Exception as e:
        logger.error(f"Error analyzing CSV dataset: {str(e)}")
        return {
            "success": False,
            "error": f"Error analyzing CSV dataset: {str(e)}"
        }
