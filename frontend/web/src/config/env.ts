/**
 * Centralized environment configuration.
 * The frontend communicates exclusively with the Spring Cloud API Gateway.
 */
export const DEFAULT_API_BASE_URL = 'http://localhost:8080';

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
