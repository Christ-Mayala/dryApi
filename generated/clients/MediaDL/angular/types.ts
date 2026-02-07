export interface DownloadsCreate {
  url: string;
  mediaType: string;
  filename: string;
  qualityMode: string;
  presetId?: string;
  batchId?: string;
  label: string;
}

export interface DownloadsUpdate {
  jobStatus?: string;
  error?: string;
  sizeBytes?: number;
  path?: string;
  finishedAt?: string;
}

export interface BatchesCreate {
  label: string;
  sourceType: string;
  total: number;
  completed: number;
  failed: number;
  createdBy?: string;
  startedAt: string;
  finishedAt: string;
  status?: string;
}

export interface BatchesUpdate {
  label?: string;
  sourceType?: string;
  total?: number;
  completed?: number;
  failed?: number;
  createdBy?: string;
  startedAt?: string;
  finishedAt?: string;
  status?: string;
}

export interface PresetsCreate {
  label: string;
  qualityMode: string;
  preferAudioOnly: boolean;
  maxHeight: number;
  downloadDir: string;
  concurrent: number;
  status?: string;
}

export interface PresetsUpdate {
  label?: string;
  qualityMode?: string;
  preferAudioOnly?: boolean;
  maxHeight?: number;
  downloadDir?: string;
  concurrent?: number;
  status?: string;
}
