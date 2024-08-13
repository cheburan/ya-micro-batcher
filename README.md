# YaMicroBatcher

`YaMicroBatcher` (Yet Another Micro Batcher) is a lightweight library for batching jobs in a microservice architecture. It allows you to submit jobs and process them in batches, either when a certain batch size is reached or after a specified timeout.

## Installation

```bash
npm install ya-micro-batcher
```

## Why use microbatching?

Micro-batching can be highly effective in scenarios where individual task processing is inefficient due to overhead costs, such as database writes, network calls, or computation-heavy tasks. By bundling tasks into manageable batches, `YaMicroBatcher` optimizes performance and resource utilization.

## Main features

- **Batch Size Limit:** Specify the maximum number of jobs per batch.
- **Timeout-Based Processing:** Define how long the micro-batcher should wait before processing a batch.
- **Memory-Based Auto Processing:** Automatically process jobs when a specified memory limit is reached.
- **Acknowledgement Support:** Optionally receive acknowledgements when jobs are submitted.
- **Custom Batch Processing Logic:** Provide your own processing logic to handle the batched jobs.
- **Graceful Shutdown:** Ensure no jobs are lost when shutting down the batcher.

## Configuration

`YaMicroBatcher` is initialized with a configuration object:

```typescript
export interface YaMicroBatcherConfig<T> {
  batchSize: number;
  batchTimeout: number;
  batchProcessor: (jobs: Map<string, T>) => Promise<JobResult<T>[]>;
  returnAck?: boolean;
  memoryLimit?: number;
  autoProcessOnMemoryLimit?: boolean;
  storePastJobs?: boolean;
}
```

### Configuration Options

- **`batchSize`** (number): Maximum number of jobs in a batch (default: 10, max: 1000).
- **`batchTimeout`** (number): Maximum time (in ms) before processing a batch (default: 1000 ms, max: 100000 ms).
- **`batchProcessor`** (function): Function to process the batch of jobs.
- **`returnAck`** (boolean): Whether to return an acknowledgement when a job is submitted (default: false).
- **`memoryLimit`** (number): Maximum memory (in MB) for job storage before auto-processing (default: 10 MB, max: 1024 MB).
- **`autoProcessOnMemoryLimit`** (boolean): Automatically process jobs when memory limit is reached (default: false).
- **`storePastJobs`** (boolean): Option to store processed jobs (default: false).

## Public Methods

### `submit(job: T): Promise<void | AckJobSubmitted>`

Submit a job to the micro-batcher.

**Parameters:**

- `job` (T): The job to be submitted.

**Returns:**

- A promise that resolves to `AckJobSubmitted` if `returnAck` is true, otherwise resolves to `void`.

**Example:**

```typescript
await microBatcher.submit({ data: "some data" });
```

### `shutdown(): Promise<void>`

Shut down the micro-batcher, ensuring all jobs are processed before shutdown.

**Example:**

```typescript
await microBatcher.shutdown();
```

### `stop(): Promise<void>`

Stop the micro-batcher from processing any more jobs and clear the current jobs.

**Example:**

```typescript
await microBatcher.stop();
```

### `forceProcess(): Promise<void>`

Force process the jobs in the micro-batcher, regardless of batch size or timeout.

**Example:**

```typescript
await microBatcher.forceProcess();
```

### `jobCount(): number`

Get the number of jobs currently in the micro-batcher.

**Returns:**

- The number of jobs in the micro-batcher.

**Example:**

```typescript
const jobCount = microBatcher.jobCount();
```

### `jobStatus(jobId: string): AckJobSubmitted`

Get the status of a job by its `jobId`.

**Parameters:**

- `jobId` (string): The ID of the job to query.

**Returns:**

- The status of the job as `AckJobSubmitted`.

**Example:**

```typescript
const jobStatus = microBatcher.jobStatus("some-job-id");
```

### `isMemoryLimitReached(): boolean`

Check if the memory limit for the batcher has been reached.

**Returns:**

- `true` if the memory limit is reached, otherwise `false`.

**Example:**

```typescript
const limitReached = microBatcher.isMemoryLimitReached();
```

## Private Properties

### `batchProcessor: (jobs: Map<string, T>) => Promise<JobResult<T>[]>`

A function provided in the configuration to process the batched jobs.

### `batchSize: number`

The maximum number of jobs that can be batched together.

### `batchTimeout: number`

The time (in ms) before a batch is processed.

### `memoryLimit: number`

The maximum memory (in MB) allowed for job storage.

### `autoProcessOnMemoryLimit: boolean`

Determines if jobs should be processed automatically when the memory limit is reached.

### `currentMemory: number`

Tracks the current memory usage of jobs.

### `jobs: Map<string, T>`

A map storing the current jobs.

### `finishedJobs: Map<string, T>`

A map storing finished jobs if `storePastJobs` is enabled.

### `timeoutId: NodeJS.Timeout | null`

Stores the timeout ID for the batch processing schedule.

### `shutDown: boolean`

Indicates if the micro-batcher has been shut down.

### `isProcessing: boolean`

Tracks if the batcher is currently processing jobs.

### `returnAck: boolean`

Determines if an acknowledgement should be returned when a job is submitted.

## Example Usage

```typescript
import { YaMicroBatcher, YaMicroBatcherConfig, JobResult } from "ya-micro-batcher";

const batchProcessor = async (jobs: Map<string, { data: string }>): Promise<JobResult<{ data: string }>[]> => {
  // Custom processing logic here
  return [...jobs].map(([jobId, job]) => ({
    status: JobStatus.PROCESSED,
    jobId,
    result: job,
  }));
};

const config: YaMicroBatcherConfig<{ data: string }> = {
  batchSize: 100,
  batchTimeout: 5000,
  batchProcessor,
  returnAck: true,
  memoryLimit: 50,
  autoProcessOnMemoryLimit: true,
};

const microBatcher = new YaMicroBatcher(config);

await microBatcher.submit({ data: "example job" });
```

Here is the markdown segment to add to your README.md under a "Future Enhancements" or "TODO" section:

## TODO / Future Enhancements

- [ ] **Error Handling and Retry Mechanism**
  - Implement a retry mechanism for failed jobs with configurable retry count and delay.
  - Support exponential backoff for retry delays.
  - Allow custom error handling logic to manage specific error scenarios.

- [ ] **Concurrency Control** ???
  - Add support for processing jobs concurrently with a configurable maximum number of concurrent jobs.
  - Introduce job prioritization to process higher-priority jobs first.
  - Optionally implement throttling to limit the number of jobs processed per unit time.

- [ ] **Job Persistence**
  - Provide a persistence layer to save jobs to a database or file system for recovery after a system crash.
  - Implement job recovery on startup to re-queue pending or in-progress jobs.

- [ ] **Job Monitoring and Metrics**
  - Introduce real-time metrics on job counts, memory usage, processing times, and success/failure rates.
  - Implement health checks to monitor the micro-batcher's performance and alert users if issues arise.
  - Add detailed logging with support for different log levels (info, debug, error).

- [ ] **Customizable Batch Processing Strategies**
  - Allow users to define custom strategies for how jobs are grouped into batches.
  - Support conditional batching based on custom criteria (e.g., job type, priority).
  - Implement adaptive batching logic to dynamically adjust batch size and processing intervals based on system load.

Feel free to contribute to these features or suggest new ones by submitting a pull request or opening an issue.

## License

MIT License.