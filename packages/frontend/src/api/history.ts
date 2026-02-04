import Sender from '@services/Sender';
import { ApiResponse, HistoryResponse } from '@common';

export const getFileHistory = (filePath: string): Promise<ApiResponse<any>> =>
  Sender.postWithPromise('/api/history/get_one_file', { filePath });

export const listHistory = (page: number): Promise<ApiResponse<HistoryResponse>> =>
  Sender.postWithPromise('/api/history/list', { page });

export const addHistoryRecord = (filePath: string): Promise<ApiResponse<any>> =>
  Sender.postWithPromise('/api/history/add', { filePath });
