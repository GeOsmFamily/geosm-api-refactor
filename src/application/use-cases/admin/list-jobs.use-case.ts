export interface JobInfo {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
}

export class ListJobsUseCase {
  async execute(): Promise<JobInfo[]> {
    // Placeholder — will be connected to a real job queue later
    return [];
  }
}
