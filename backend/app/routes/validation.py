from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
import uuid
from datetime import datetime
import psycopg2
import pandas as pd
import json
import os

from app.database import get_db
from app.models.validation import ValidationCheck, ValidationResult
from app.models.postgres import PostgresConnection
from app.models.dataset import CsvDataset
from app.schemas.validation import (
    ValidationCheckCreate,
    ValidationCheckResponse,
    ValidationResultResponse,
    ApiResponse,
    ValidationStatus
)

router = APIRouter()

@router.get("/checks", response_model=ApiResponse)
async def get_all_checks(db: Session = Depends(get_db)):
    """Get all validation checks"""
    checks = db.query(ValidationCheck).order_by(ValidationCheck.created_at.desc()).all()
    return {
        "success": True,
        "data": [check.to_dict() for check in checks]
    }

@router.get("/checks/{check_id}", response_model=ApiResponse)
async def get_check_by_id(check_id: str, db: Session = Depends(get_db)):
    """Get a validation check by ID"""
    check = db.query(ValidationCheck).filter(ValidationCheck.id == check_id).first()
    if not check:
        return {
            "success": False,
            "error": "Validation check not found"
        }
    
    return {
        "success": True,
        "data": check.to_dict()
    }

@router.post("/checks", response_model=ApiResponse)
async def create_check(check: ValidationCheckCreate, db: Session = Depends(get_db)):
    """Create a new validation check"""
    # Create new check object
    new_check = ValidationCheck(
        id=f"check_{uuid.uuid4()}",
        name=check.name,
        type=check.type,
        dataset=check.dataset.dict(),
        table=check.table,
        column=check.column,
        parameters=check.parameters,
        created_at=datetime.now()
    )
    
    # Save to database
    db.add(new_check)
    db.commit()
    db.refresh(new_check)
    
    return {
        "success": True,
        "data": new_check.to_dict()
    }

@router.get("/results", response_model=ApiResponse)
async def get_all_results(db: Session = Depends(get_db)):
    """Get all validation results"""
    results = db.query(ValidationResult).order_by(ValidationResult.created_at.desc()).all()
    return {
        "success": True,
        "data": [result.to_dict() for result in results]
    }

@router.get("/results/{result_id}", response_model=ApiResponse)
async def get_result_by_id(result_id: str, db: Session = Depends(get_db)):
    """Get a validation result by ID"""
    result = db.query(ValidationResult).filter(ValidationResult.id == result_id).first()
    if not result:
        return {
            "success": False,
            "error": "Validation result not found"
        }
    
    return {
        "success": True,
        "data": result.to_dict()
    }

@router.post("/run/{check_id}", response_model=ApiResponse)
async def run_validation(check_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Run a validation check"""
    # Get the check from the database
    check = db.query(ValidationCheck).filter(ValidationCheck.id == check_id).first()
    if not check:
        return {
            "success": False,
            "error": "Validation check not found"
        }
    
    # Run the validation in the background
    background_tasks.add_task(
        run_validation_task,
        db_session=db,
        check=check
    )
    
    return {
        "success": True,
        "message": "Validation started in the background"
    }

async def run_validation_task(db_session: Session, check: ValidationCheck):
    """Run a validation check in the background"""
    try:
        # Run the validation based on the check type and dataset type
        if check.dataset["type"] == "postgres":
            validation_result = await run_postgres_validation(db_session, check)
        else:
            validation_result = await run_csv_validation(db_session, check)
        
        # Save the result to the database
        new_result = ValidationResult(
            id=validation_result["id"],
            check_id=validation_result["checkId"],
            check_name=validation_result["checkName"],
            dataset=validation_result["dataset"],
            table=validation_result["table"],
            column=validation_result["column"],
            status=validation_result["status"],
            metrics=validation_result["metrics"],
            failed_rows=validation_result["failedRows"] if "failedRows" in validation_result else None,
            error_message=validation_result["errorMessage"] if "errorMessage" in validation_result else None,
            created_at=datetime.now()
        )
        
        db_session.add(new_result)
        db_session.commit()
        
    except Exception as e:
        # Create an error result
        error_result = ValidationResult(
            id=f"result_{uuid.uuid4()}",
            check_id=check.id,
            check_name=check.name,
            dataset=check.dataset,
            table=check.table,
            column=check.column,
            status="error",
            metrics={},
            error_message=str(e),
            created_at=datetime.now()
        )
        
        db_session.add(error_result)
        db_session.commit()

async def run_postgres_validation(db_session: Session, check: ValidationCheck) -> Dict[str, Any]:
    """Run validation on a PostgreSQL dataset"""
    # Get the PostgreSQL connection
    connection = db_session.query(PostgresConnection).filter(PostgresConnection.id == check.dataset["id"]).first()
    if not connection:
        raise ValueError("PostgreSQL connection not found")
    
    # Connect to the database
    conn = psycopg2.connect(
        host=connection.host,
        port=connection.port,
        database=connection.database,
        user=connection.username,
        password=connection.password
    )
    
    cursor = conn.cursor()
    
    # Initialize variables
    start_time = datetime.now()
    failed_rows = []
    passed = False
    
    try:
        # Run validation based on check type
        if check.type == "missing_values":
            # Count total rows and rows with missing values
            cursor.execute(f'SELECT COUNT(*) FROM "{check.table}"')
            total_rows = cursor.fetchone()[0]
            
            cursor.execute(f'SELECT COUNT(*) FROM "{check.table}" WHERE "{check.column}" IS NULL OR TRIM("{check.column}"::TEXT) = \'\'')
            missing_count = cursor.fetchone()[0]
            
            threshold = (check.parameters.get("threshold", 0) * total_rows) / 100
            passed = missing_count <= threshold
            
            if not passed:
                # Get examples of rows with missing values
                cursor.execute(f'''
                    SELECT * FROM "{check.table}" 
                    WHERE NULLIF(TRIM("{check.column}"::TEXT), '') IS NULL 
                    LIMIT 10
                ''')
                columns = [desc[0] for desc in cursor.description]
                
                for row in cursor.fetchall():
                    row_dict = dict(zip(columns, row))
                    row_dict["_reason"] = f'Missing value in column "{check.column}"'
                    failed_rows.append(row_dict)
            
            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return {
                "id": f"result_{uuid.uuid4()}",
                "checkId": check.id,
                "checkName": check.name,
                "dataset": check.dataset,
                "table": check.table,
                "column": check.column,
                "status": "passed" if passed else "failed",
                "metrics": {
                    "rowCount": total_rows,
                    "executionTimeMs": execution_time,
                    "passedCount": total_rows - missing_count,
                    "failedCount": missing_count
                },
                "failedRows": failed_rows if failed_rows else None
            }
            
        elif check.type == "unique_values":
            # Count total rows and find duplicates
            cursor.execute(f'SELECT COUNT(*) FROM "{check.table}"')
            total_rows = cursor.fetchone()[0]
            
            cursor.execute(f'SELECT "{check.column}", COUNT(*) FROM "{check.table}" GROUP BY "{check.column}" HAVING COUNT(*) > 1')
            duplicates = cursor.fetchall()
            
            passed = len(duplicates) == 0
            duplicate_count = sum(count - 1 for _, count in duplicates)
            
            if not passed:
                # Get examples of duplicated values
                for dup_value, _ in duplicates[:5]:
                    cursor.execute(f'SELECT * FROM "{check.table}" WHERE "{check.column}" = %s LIMIT 10', (dup_value,))
                    columns = [desc[0] for desc in cursor.description]
                    
                    for row in cursor.fetchall():
                        row_dict = dict(zip(columns, row))
                        row_dict["_reason"] = f'Duplicate value in column "{check.column}": {dup_value}'
                        failed_rows.append(row_dict)
            
            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return {
                "id": f"result_{uuid.uuid4()}",
                "checkId": check.id,
                "checkName": check.name,
                "dataset": check.dataset,
                "table": check.table,
                "column": check.column,
                "status": "passed" if passed else "failed",
                "metrics": {
                    "rowCount": total_rows,
                    "executionTimeMs": execution_time,
                    "passedCount": total_rows - duplicate_count,
                    "failedCount": duplicate_count
                },
                "failedRows": failed_rows if failed_rows else None
            }
            
        # Add more validation types as needed...
            
        else:
            raise ValueError(f"Unsupported validation type: {check.type}")
            
    finally:
        conn.close()

async def run_csv_validation(db_session: Session, check: ValidationCheck) -> Dict[str, Any]:
    """Run validation on a CSV dataset"""
    # Get the CSV dataset
    dataset = db_session.query(CsvDataset).filter(CsvDataset.id == check.dataset["id"]).first()
    if not dataset:
        raise ValueError("CSV dataset not found")
    
    # Make sure the file exists
    if not os.path.exists(dataset.file_path):
        raise ValueError(f"CSV file not found at: {dataset.file_path}")
    
    # Read the CSV file
    df = pd.read_csv(dataset.file_path)
    
    # Initialize metrics
    start_time = datetime.now()
    failed_rows = []
    passed = False
    
    # Run validation based on check type
    if check.type == "missing_values":
        # Check for missing values in the column
        if check.column not in df.columns:
            raise ValueError(f"Column '{check.column}' not found in CSV file")
        
        # Count missing values
        missing_count = df[check.column].isna().sum() + df[check.column].eq('').sum()
        total_rows = len(df)
        
        # Check against threshold
        threshold = (check.parameters.get("threshold", 0) * total_rows) / 100
        passed = missing_count <= threshold
        
        # Get examples of rows with missing values
        if not passed:
            missing_rows = df[df[check.column].isna() | df[check.column].eq('')].head(10).to_dict('records')
            for row in missing_rows:
                row_dict = row.copy()
                row_dict["_reason"] = f'Missing value in column "{check.column}"'
                failed_rows.append(row_dict)
        
        execution_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return {
            "id": f"result_{uuid.uuid4()}",
            "checkId": check.id,
            "checkName": check.name,
            "dataset": check.dataset,
            "column": check.column,
            "status": "passed" if passed else "failed",
            "metrics": {
                "rowCount": total_rows,
                "executionTimeMs": execution_time,
                "passedCount": total_rows - missing_count,
                "failedCount": missing_count
            },
            "failedRows": failed_rows if failed_rows else None
        }
    
    elif check.type == "unique_values":
        # Check for unique values in the column
        if check.column not in df.columns:
            raise ValueError(f"Column '{check.column}' not found in CSV file")
        
        # Count duplicate values
        total_rows = len(df)
        duplicates = df[df.duplicated(subset=[check.column], keep=False)].groupby(check.column).size().reset_index(name='count')
        
        passed = len(duplicates) == 0
        duplicate_count = sum(duplicates['count'] - 1) if not passed else 0
        
        # Get examples of rows with duplicate values
        if not passed:
            for _, row in duplicates.head(5).iterrows():
                dup_value = row[check.column]
                dup_rows = df[df[check.column] == dup_value].head(5).to_dict('records')
                for dup_row in dup_rows:
                    dup_row["_reason"] = f'Duplicate value in column "{check.column}": {dup_value}'
                    failed_rows.append(dup_row)
        
        execution_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return {
            "id": f"result_{uuid.uuid4()}",
            "checkId": check.id,
            "checkName": check.name,
            "dataset": check.dataset,
            "column": check.column,
            "status": "passed" if passed else "failed",
            "metrics": {
                "rowCount": total_rows,
                "executionTimeMs": execution_time,
                "passedCount": total_rows - duplicate_count,
                "failedCount": duplicate_count
            },
            "failedRows": failed_rows if failed_rows else None
        }
    
    # Add more validation types as needed...
    
    else:
        raise ValueError(f"Unsupported validation type: {check.type}")
