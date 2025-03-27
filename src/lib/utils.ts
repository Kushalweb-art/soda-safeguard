import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const fetchCsvDatasets = async () => {
  try {
    const response = await fetch("http://127.0.0.1:8000/api/datasets/csv");
    return await response.json();
  } catch (error) {
    console.error("Error fetching CSV datasets:", error);
    return { success: false, data: [] };
  }
};

export const fetchPostgresConnections = async () => {
  try {
    const response = await fetch("http://127.0.0.1:8000/api/postgres/connections");
    return await response.json();
  } catch (error) {
    console.error("Error fetching PostgreSQL connections:", error);
    return { success: false, data: [] };
  }
};

