import Sender from '@services/Sender';

export const listDirectory = (params) =>
  Sender.postWithPromise('/api/folder/list_dir', params);

export const listImageFolderContent = ({ filePath, startIndex = 0 }) =>
  Sender.postWithPromise('/api/folder/list_image_content', { filePath, startIndex });

export const addFileWatch = (filePath) =>
  Sender.postWithPromise('/api/folder/add_file_watch', { filePath });

export const deleteFolder = (src) =>
  Sender.postWithPromise('/api/folder/delete', { src });

export const zipFolder = (src) =>
  Sender.postWithPromise('/api/folder/zip', { src });
