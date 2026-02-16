// Test exports for Node.js testing
// This file exports the library functions needed by test scripts

export { parseGpx, convertGpxToGarminCourse } from './gpx-parser';
export type { GpxRoute, GpxPoint, GpxWaypoint } from './gpx-parser';
export type { ActivityType, GarminCourse } from '../shared/messages';
