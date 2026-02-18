// Custom error types for better error handling

export class MapyGarminError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'MapyGarminError';
  }
}

export enum ErrorCode {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  AUTH_NETWORK_ERROR = 'AUTH_NETWORK_ERROR',
  AUTH_MFA_REQUIRED = 'AUTH_MFA_REQUIRED',

  // Route extraction errors
  ROUTE_NOT_FOUND = 'ROUTE_NOT_FOUND',
  ROUTE_EXTRACTION_FAILED = 'ROUTE_EXTRACTION_FAILED',
  GPX_PARSE_ERROR = 'GPX_PARSE_ERROR',
  GEOJSON_PARSE_ERROR = 'GEOJSON_PARSE_ERROR',

  // Upload errors
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  UPLOAD_QUOTA_EXCEEDED = 'UPLOAD_QUOTA_EXCEEDED',
  UPLOAD_DUPLICATE = 'UPLOAD_DUPLICATE',

  // Storage errors
  STORAGE_ERROR = 'STORAGE_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',

  // Folder errors
  FOLDER_NOT_FOUND = 'FOLDER_NOT_FOUND',
  FOLDER_EXPORT_FAILED = 'FOLDER_EXPORT_FAILED',
  FOLDER_EMPTY = 'FOLDER_EMPTY',
  FOLDER_MULTIPLE_ROUTES = 'FOLDER_MULTIPLE_ROUTES',

  // Security errors
  URL_VALIDATION = 'URL_VALIDATION',

  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid username or password',
  [ErrorCode.AUTH_SESSION_EXPIRED]: 'Session expired, please log in again',
  [ErrorCode.AUTH_NETWORK_ERROR]: 'Network error during authentication',
  [ErrorCode.AUTH_MFA_REQUIRED]: 'Multi-factor authentication is required',

  [ErrorCode.ROUTE_NOT_FOUND]: 'No route found on the current page',
  [ErrorCode.ROUTE_EXTRACTION_FAILED]: 'Failed to extract route data',
  [ErrorCode.GPX_PARSE_ERROR]: 'Failed to parse GPX data',
  [ErrorCode.GEOJSON_PARSE_ERROR]: 'Failed to parse GeoJSON data',

  [ErrorCode.UPLOAD_FAILED]: 'Failed to upload course to Garmin Connect',
  [ErrorCode.UPLOAD_QUOTA_EXCEEDED]: 'Garmin Connect upload quota exceeded',
  [ErrorCode.UPLOAD_DUPLICATE]: 'This course already exists in Garmin Connect',

  [ErrorCode.STORAGE_ERROR]: 'Failed to access extension storage',
  [ErrorCode.ENCRYPTION_ERROR]: 'Failed to encrypt/decrypt data',

  [ErrorCode.FOLDER_NOT_FOUND]: 'Folder not found or not accessible',
  [ErrorCode.FOLDER_EXPORT_FAILED]: 'Failed to export folder from Mapy.cz',
  [ErrorCode.FOLDER_EMPTY]: 'This folder contains no routes',
  [ErrorCode.FOLDER_MULTIPLE_ROUTES]: 'This folder contains multiple routes. Please sync individual routes instead.',

  [ErrorCode.URL_VALIDATION]: 'Invalid or unsafe URL',

  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred',
  [ErrorCode.NETWORK_ERROR]: 'Network connection error',
};

export function getErrorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
}
