import Sender from '@services/Sender';

export const getFileHistory = (filePath) =>
  Sender.postWithPromise('/api/history/get_one_file', { filePath });

export const listHistory = (page) =>
  Sender.postWithPromise('/api/history/list', { page });

export const addHistoryRecord = (filePath) =>
  Sender.postWithPromise('/api/history/add', { filePath });
