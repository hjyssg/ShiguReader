import Sender from '@services/Sender';

export const getInfo = (filePath) =>
  Sender.postWithPromise('/api/file/get_info', { filePath });

export const deleteFile = (src) =>
  Sender.postWithPromise('/api/file/delete', { src });

export const moveFile = (src, dest) =>
  Sender.postWithPromise('/api/file/move', { src, dest });

export const renameFile = (src, dest) =>
  Sender.postWithPromise('/api/file/rename', { src, dest });
