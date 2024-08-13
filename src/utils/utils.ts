import { randomUUID } from 'crypto';

/**
 * Generates a UUID string
 * @returns string - A UUID string
 */
export const generateUUID = (): string => {
  return randomUUID();
};

/**
 * Calculate the memory needed for the current array of unknown elements (jobs). Return the memory in mega bytes
 * THIS IS SIMPLIFIED & PROBABLY NOT THE FASTEST IMPLEMENTATION. 
 * It doesn't fully covers the memory calculation for all types of objects or edge cases like circular references.
 * @param jobs - The array of jobs to calculate the memory for
 * @returns number - The memory needed for the array of jobs
 * @example const memory = calculateMemory(jobs);
 */

export const calculateMemory = (jobs: unknown[]): number => {
  return Buffer.byteLength(JSON.stringify(jobs), 'utf8') / 1024 / 1024;
}

/**
 * Function to asses if the memory limit is reached
 * @param jobs - The array of jobs to calculate the memory for
 * @param memoryLimit - The memory limit in mega bytes
 * @returns boolean - True if the memory limit is reached, False otherwise
 * @example const isMemoryLimitReached = isMemoryLimitReached(jobs, 10);
 */
export const isMemoryLimitReached = (jobs: unknown[], memoryLimit: number): boolean => {
  return calculateMemory(jobs) >= memoryLimit;
}