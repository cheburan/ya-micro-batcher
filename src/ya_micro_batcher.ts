import { calculateMemory, generateUUID, isMemoryLimitReached } from "./utils/utils";

export interface YaMicroBatcherConfig<T> {
  batchSize: number;
  batchTimeout: number;
  batchProcessor: (jobs: Map<string, T>) => Promise<JobResult<T>[]>;
  returnAck?: boolean;
  memoryLimit?: number;
  autoProcessOnMemoryLimit?: boolean;
  storePastJobs?: boolean;

}

export enum JobStatus {
  SUBMITTED = "submitted",
  FAILED = "failed",
  PROCESSED = "processed",
  TIMEOUT = "timeout",
  NOT_FOUND = "not found",
}

export interface AckJobSubmitted {
  status: JobStatus;
  message?: string;
  jobId: string;
}

export interface JobResult<T> {
  status: JobStatus;
  message?: string;
  jobId: string;
  result: T | undefined;
}

export type BatchProcessor<T> = (jobs: T[]) => Promise<JobResult<T>[]>;


/**
 * Class to create a micro-batcher
 * @param config - The configuration object for the micro-batcher
 *    @field batchSize - The maximum number of jobs to batch together, cannot be more than 1000
 *    @field batchTimeout - The maximum time to wait before processing the jobs
 *    @field batchProcessor - The function to process the batched jobs
 *    @field returnAck - A boolean to determine if the submit function should return an AckJobSubmitted object
 *    @field memoryLimit - The maximum number of jobs to store in the pastJobs map
 */
export class YaMicroBatcher<T> {
  private batchProcessor: (jobs: Map<string, T>) => Promise<JobResult<T>[]>;
  private batchSize: number;
  private batchTimeout: number; // the timeout for the batch size
  private memoryLimit: number = 10; // the memory limit for the batch size in MegaBytes
  private autoProcessOnMemoryLimit: boolean = false; // if true, the batcher will process the jobs when the memory limit is reached
  private currentMemory: number = 0; // the current memory used by the jobs in MB
  private jobs: Map<string, T> = new Map();
  private finishedJobs: Map<string, T> = new Map();
  private timeoutId: NodeJS.Timeout | null = null;
  private shutDown: boolean = false;
  private isProcessing: boolean = false;
  private returnAck: boolean;

  constructor(config: YaMicroBatcherConfig<T>) {
    // Set the maximum and default values for the config parameters
    this.batchSize = config.batchSize ? config.batchSize > 1000 ? 1000 : config.batchSize : 10; // Cannot be more than 1000
    this.batchTimeout = config.batchTimeout ?? config.batchTimeout > 100000 ? 100000 : config.batchTimeout; // Cannot be more than 1000000 ms, Default - 1000 ms
    this.memoryLimit = config.memoryLimit ? config.memoryLimit > 1024 ? 1024 : config.memoryLimit : 10; // Cannot be more than 1024 MB, Default - 10 MB
    this.autoProcessOnMemoryLimit = config.autoProcessOnMemoryLimit ?? false;
    this.returnAck = config.returnAck ?? false;
    this.currentMemory = 0;

    if (!config.batchProcessor) {
      throw new Error("batchProcessor is required");
    }
    this.batchProcessor = config.batchProcessor;
  }

  /**
   * Function to submit a single job to the micro-batcher
   * @param job - The job to submit
   * @returns Promise<void | AckJobSubmitted> - If returnAck is true, it will return an AckJobSubmitted object
   * @example await microBatcher.submit({ data: "some data" });
   */
  public async submit(job: T): Promise<void | AckJobSubmitted> {
    // Check if the micro-batcher is shutdown
    if (this.shutDown) return Promise.reject("MicroBatcher is shutdown");
    // Check if the memory will be exceeded

    const jobId = generateUUID();
    this.jobs.set(jobId, job);

    this.currentMemory += calculateMemory([job]);

    this.processingShedule();
    return this.returnAck ? Promise.resolve({ status: JobStatus.SUBMITTED, jobId }) : Promise.resolve();
  }

  /**
   * Function to control the prcoessing shedule
   * @returns void
   * @example this.processingShedule();
   */
  private processingShedule(): void {
    if (this.isProcessing) return;

    if (this.jobs.size >= this.batchSize || (this.autoProcessOnMemoryLimit && this.currentMemory >= this.memoryLimit)) {
      this.processJobs().catch((error) => {
        console.error(error);
      });
    } else {
      if (this.timeoutId) clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => this.processJobs(), this.batchTimeout);
    }

  }

  /**
   * Function to shutdown the micro-batcher and prevent any more jobs to be submitted to it
   * @returns Promise<void> - A promise that resolves when the micro-batcher is shutdown
   * @example await microBatcher.shutdown();
   */
  public async shutdown(): Promise<void> {
    this.shutDown = true;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    if (this.jobs.size > 0) {
      await this.processJobs();
    }
  }

  /**
   * Function to stop the micro-batcher from processing any more jobs and clear the jobs in the micro-batcher
   * @returns Promise<void> - A promise that resolves when the micro-batcher is stopped
   * @example await microBatcher.stop();
   */
  public async stop(): Promise<void> {
    this.shutDown = true;
    this.jobs = new Map();
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }




  /**
   * Function to force process the jobs in the micro-batcher
   * @returns Promise<void> - A promise that resolves when the jobs are processed
   * @example await microBatcher.forceProcess();
   */
  public async forceProcess(): Promise<void> {
    await this.processJobs();
  }

  /**
   * Function to get the number of jobs in the micro-batcher
   * @returns number - The number of jobs in the micro-batcher
   * @example const jobCount = microBatcher.jobCount();
   */
  public jobCount(): number {
    if (this.isProcessing) return 0
    return this.jobs.size;
  }

  /**
   * Function to get the status of the job in the micro-batcher with the given jobId
   * @param jobId - The jobId to get the status of
   * @returns AckJobSubmitted - The status of the job
   * @example const jobStatus = microBatcher.jobStatus("some-job-id");
   */
  public jobStatus(jobId: string): AckJobSubmitted {
    if (this.jobs.has(jobId)) {
      return { status: JobStatus.SUBMITTED, jobId };
    }
    return { status: JobStatus.NOT_FOUND, jobId };
  }

  /**
   * Function to force process the jobs in the micro-batcher
   * @returns Promise<void> - A promise that resolves when the jobs are processed
   * @example await microBatcher.forceProcess();
   */
  private async processJobs() {
    this.isProcessing = true;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.jobs.size === 0) {
      this.currentMemory = 0;
      this.isProcessing = false;
      return;
    }
    const jobs = this.jobs;
    this.jobs = new Map();
    this.currentMemory = 0;
    await this.batchProcessor(jobs)
      .then((results) => {
        results.forEach((result) => {
          this.finishedJobs.set(result.jobId, jobs.get(result.jobId)!);
        });
      });
    this.jobs.clear();
    this.isProcessing = false;
  }

  /**
   * Function to check if the memory limit is reached
   * @returns boolean - True if the memory limit is reached, False otherwise
   * @example const isMemoryLimitReached = microBatcher.isMemoryLimitReached();
   */
  public isMemoryLimitReached(): boolean {
    return isMemoryLimitReached(Array.from(this.jobs.values()), this.memoryLimit);
  }
}