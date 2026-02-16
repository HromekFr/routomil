// Garmin Connect API client for uploading courses via Course API

import { MapyGarminError, ErrorCode } from '../shared/errors';
import { getSessionCookies } from './garmin-auth';
import { GarminCourse } from '../shared/messages';

const GARMIN_COURSE_API_URL = 'https://connect.garmin.com/gc-api/course-service/course';

interface CourseUploadResponse {
  courseId: number;
  courseName: string;
  distanceMeter: number;
  createDate: string;
}

/**
 * Upload course to Garmin Connect via Course API
 * Reference: test-course-api.js lines 259-296
 * @param courseData - Garmin Course JSON structure
 * @param csrfToken - CSRF token from Garmin Connect page
 * @returns Course ID and name
 */
export async function uploadCourse(
  courseData: GarminCourse,
  csrfToken: string
): Promise<{ courseId: string; courseName: string }> {
  const cookies = await getSessionCookies();

  if (!cookies) {
    throw new MapyGarminError('Not authenticated', ErrorCode.AUTH_SESSION_EXPIRED);
  }

  const response = await fetch(GARMIN_COURSE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'connect-csrf-token': csrfToken,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Origin': 'https://connect.garmin.com',
      'Referer': 'https://connect.garmin.com/modern/import-data',
    },
    body: JSON.stringify(courseData),
    credentials: 'include',
  });

  // Handle authentication errors
  if (response.status === 401) {
    throw new MapyGarminError('Session expired, please log in again', ErrorCode.AUTH_SESSION_EXPIRED);
  }

  if (response.status === 403) {
    throw new MapyGarminError('CSRF token invalid or expired, please try again', ErrorCode.AUTH_SESSION_EXPIRED);
  }

  if (response.status === 409) {
    throw new MapyGarminError('This course already exists in Garmin Connect', ErrorCode.UPLOAD_DUPLICATE);
  }

  if (response.status === 429) {
    throw new MapyGarminError('Upload quota exceeded, please try again later', ErrorCode.UPLOAD_QUOTA_EXCEEDED);
  }

  if (response.status === 400) {
    const errorText = await response.text();
    throw new MapyGarminError(
      `Invalid course data (${response.status}): ${errorText}`,
      ErrorCode.UPLOAD_FAILED
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new MapyGarminError(
      `Upload failed (${response.status}): ${errorText}`,
      ErrorCode.UPLOAD_FAILED
    );
  }

  // Check content type before parsing
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    const responseText = await response.text();
    throw new MapyGarminError(
      `Upload failed: Expected JSON response but got ${contentType}. Response: ${responseText.substring(0, 200)}`,
      ErrorCode.UPLOAD_FAILED
    );
  }

  let result: CourseUploadResponse;
  try {
    result = await response.json();
  } catch (error) {
    throw new MapyGarminError(
      `Failed to parse upload response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.UPLOAD_FAILED
    );
  }

  // Validate response has required fields
  if (!result.courseId) {
    throw new MapyGarminError('Upload completed but no course ID was returned', ErrorCode.UPLOAD_FAILED);
  }

  return {
    courseId: String(result.courseId),
    courseName: result.courseName,
  };
}

// Get course URL for viewing in Garmin Connect
export function getCourseUrl(courseId: string): string {
  return `https://connect.garmin.com/modern/course/${courseId}`;
}
