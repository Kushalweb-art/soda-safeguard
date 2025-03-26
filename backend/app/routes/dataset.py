
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
import shutil
import traceback

from app.database import get_db
from app.models.dataset import CsvDataset
from app.schemas.dataset import (
    CsvDatasetCreate,
    CsvDatasetResponse,
    ApiResponse
)

router = APIRouter()

# Create a directory to store uploaded CSV files
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
print(f"Upload directory created/verified at: {UPLOAD_DIR}")

@router.get("/csv", response_model=ApiResponse)
async def get_all_csv_datasets(db: Session = Depends(get_db)):
    """Get all CSV datasets"""
    try:
        datasets = db.query(CsvDataset).order_by(CsvDataset.uploaded_at.desc()).all()
        return {
            "success": True,
            "data": [dataset.to_dict() for dataset in datasets]
        }
    except Exception as e:
        print(f"Error in get_all_csv_datasets: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Failed to retrieve CSV datasets: {str(e)}"
        }

@router.get("/csv/{dataset_id}", response_model=ApiResponse)
async def get_csv_dataset_by_id(dataset_id: str, db: Session = Depends(get_db)):
    """Get a CSV dataset by ID"""
    try:
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
    except Exception as e:
        print(f"Error in get_csv_dataset_by_id: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Failed to retrieve CSV dataset: {str(e)}"
        }

@router.post("/csv/upload", response_model=ApiResponse)
async def upload_csv_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a CSV file and parse it"""
    try:
        print(f"Received file upload: {file.filename}")
        
        if not file.filename.endswith('.csv'):
            return {
                "success": False,
                "error": "File must be a CSV"
            }
        
        # Generate a unique ID for the dataset
        dataset_id = f"csv_{uuid.uuid4()}"
        
        # Create a path to store the file
        file_path = os.path.join(UPLOAD_DIR, f"{dataset_id}.csv")
        print(f"Saving file to: {file_path}")
        
        # Read file content
        contents = await file.read()
        
        # Save the file to disk
        with open(file_path, "wb") as f:
            f.write(contents)
        
        print(f"File saved. Reading file with pandas.")
        
        # Parse CSV using pandas
        try:
            df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
            
            # Get column names
            columns = df.columns.tolist()
            
            # Get row count
            row_count = len(df)
            
            # Get preview data (first few rows)
            preview_data = df.head(5).to_dict(orient='records')
            
            print(f"File parsed. Creating dataset object: {dataset_id}")
            
            # Create dataset object
            new_dataset = CsvDataset(
                id=dataset_id,
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
            
            print(f"Dataset created successfully: {dataset_id}")
            
            return {
                "success": True,
                "data": new_dataset.to_dict()
            }
        except Exception as e:
            print(f"Error parsing CSV file: {str(e)}")
            traceback.print_exc()
            return {
                "success": False,
                "error": f"Error parsing CSV file: {str(e)}"
            }
            
    except Exception as e:
        print(f"Error processing CSV file: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Error processing CSV file: {str(e)}"
        }

@router.get("/csv/{dataset_id}/data", response_model=ApiResponse)
async def get_csv_dataset_data(
    dataset_id: str, 
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get data from a CSV dataset with pagination"""
    try:
        dataset = db.query(CsvDataset).filter(CsvDataset.id == dataset_id).first()
        if not dataset:
            return {
                "success": False,
                "error": "Dataset not found"
            }
        
        print(f"Reading CSV file: {dataset.file_path}")
        
        if not os.path.exists(dataset.file_path):
            return {
                "success": False,
                "error": "CSV file not found on disk"
            }
        
        # Read the CSV file
        df = pd.read_csv(dataset.file_path)
        
        # Get total rows
        total_rows = len(df)
        
        # Apply pagination
        df_page = df.iloc[offset:offset+limit]
        
        # Convert to dict
        data = df_page.to_dict(orient='records')
        
        return {
            "success": True,
            "data": {
                "rows": data,
                "totalRows": total_rows,
                "columns": dataset.columns
            }
        }
    except Exception as e:
        print(f"Error reading CSV data: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Error reading CSV data: {str(e)}"
        }
