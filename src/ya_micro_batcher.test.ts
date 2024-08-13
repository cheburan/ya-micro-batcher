import {YaMicroBatcher, JobStatus } from './ya_micro_batcher';
import type {JobResult } from './ya_micro_batcher';

describe('YaMicroBatcher methods check', () => {
  let batcher: YaMicroBatcher<object>;
  const batchProcessor = async (jobs: Map<string, object>): Promise<JobResult<object>[]> => {
    const jobResults: JobResult<object>[] = [];
    for (const [jobId, job] of jobs) {
      jobResults.push({ jobId, status: JobStatus.PROCESSED, result:job });
    }
    return jobResults
  }

  beforeEach(() => {
    batcher = new YaMicroBatcher({
      batchSize: 3,
      batchTimeout: 1000,
      returnAck: true,
      memoryLimit: 10,
      autoProcessOnMemoryLimit: true,
      batchProcessor,
    });
  });

  test('should add a job', () => {
    expect(batcher.jobCount()).toBe(0);
    const job = { id: 'job1', data: 'some data' };
    batcher.submit(job);
    expect(batcher.jobCount()).toBe(1);
  });

  test('should force process all jobs', () => {
    const job1 = { id: 'job1', data: 'some data 1' };
    const job2 = { id: 'job2', data: 'some data 2' };
    expect(batcher.jobCount()).toBe(0);
    batcher.submit(job1);
    batcher.submit(job2);
    expect(batcher.jobCount()).toBe(2);
    batcher.forceProcess();
    expect(batcher.jobCount()).toBe(0);
  });

  test('should return Ask for the submitted job', async () => {
    const job1 = { id: 'job1', data: 'data1' };
    const jobID = await batcher.submit(job1);
    expect(batcher.jobCount()).toBe(1);
    expect(jobID && jobID.status).toEqual('submitted');
  });

  test('should shutdown the micro-batcher', async () => {
    const job1 = { id: 'job1', data: 'data1' };
    const job2 = { id: 'job2', data: 'data2' };
    batcher.submit(job1);
    expect(batcher.jobCount()).toBe(1);
    await batcher.shutdown();
    expect(batcher.jobCount()).toBe(0);
    const errorReturn = batcher.submit(job2);
    expect(errorReturn).rejects.toEqual('MicroBatcher is shutdown');
  });

  test('should stop the micro-batcher', async () => {
    const job1 = { id: 'job1', data: 'data1' };
    const job2 = { id: 'job2', data: 'data2' };
    batcher.submit(job1);
    expect(batcher.jobCount()).toBe(1);
    await batcher.stop();
    expect(batcher.jobCount()).toBe(0);
    const errorReturn = batcher.submit(job2);
    expect(errorReturn).rejects.toEqual('MicroBatcher is shutdown');
  });

  test('should return false cause memory limit is not reached', () => {
    const job1 = { id: 'job1', data: 'data1' };
    batcher.submit(job1);
    expect(batcher.isMemoryLimitReached()).toBe(false);
  });

  // Add more tests for other methods
});

describe('YaMicroBatcher batchSize constraint check', () => {
  let batcher: YaMicroBatcher<object>;
  const batchProcessor = async (jobs: Map<string, object>): Promise<JobResult<object>[]> => {
    const jobResults: JobResult<object>[] = [];
    for (const [jobId, job] of jobs) {
      jobResults.push({ jobId, status: JobStatus.PROCESSED, result:job });
    }
    return jobResults
  }

  beforeEach(() => {
    batcher = new YaMicroBatcher({
      batchSize: 3,
      batchTimeout: 1000,
      returnAck: true,
      memoryLimit: 10,
      autoProcessOnMemoryLimit: true,
      batchProcessor,
    });
  });

  afterAll(() => {
    batcher.stop();
  });

  test('should process jobs when batch size is reached', async() => {
    const job1 = { id: 'job1', data: 'data1' };
    const job2 = { id: 'job2', data: 'data2' };
    const job3 = { id: 'job3', data: 'data3' };
    batcher.submit(job1);
    batcher.submit(job2);
    expect(batcher.jobCount()).toBe(2);
    await batcher.submit(job3);
    //wait 1 sec before checking the job count
    await new Promise(resolve => setTimeout(resolve, 1100));
    expect(batcher.jobCount()).toBe(0);
  });

});

describe('YaMicroBatcher memoryLimit constraint check', () => {
  let batcher: YaMicroBatcher<object>;
  const batchProcessor = async (jobs: Map<string, object>): Promise<JobResult<object>[]> => {
    const jobResults: JobResult<object>[] = [];
    for (const [jobId, job] of jobs) {
      jobResults.push({ jobId, status: JobStatus.PROCESSED, result:job });
    }
    return jobResults
  }

  beforeEach(() => {
    batcher = new YaMicroBatcher({
      batchSize: 100,
      batchTimeout: 100000,
      returnAck: true,
      memoryLimit: 1,
      autoProcessOnMemoryLimit: true,
      batchProcessor,
    });
  });

  test('should process jobs when batch size is reached', async() => {
    const data = 'a'.repeat(1024 * 100); //generate a large job 100kb data filed in size
    const jobStub = { id: 'job1', data};
    batcher.submit(jobStub);
    expect(batcher.jobCount()).toBe(1);
    expect(batcher.isMemoryLimitReached()).toBe(false);
    for (let i = 0; i < 10; i++) {
      await batcher.submit(jobStub);
    }
    expect(batcher.jobCount()).toBe(0);
    
  });

});