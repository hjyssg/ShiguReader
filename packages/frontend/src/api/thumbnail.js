import Sender from '@services/Sender';

export const getTagThumbnail = (payload) =>
  Sender.postWithPromise('/api/thumbnail/get_for_tag', payload);

export const getFolderThumbnail = (filePath) => {
  const query = encodeURIComponent(filePath);
  return Sender.getWithPromise(`/api/thumbnail/get_for_folder?filePath=${query}`);
};

export const getZipThumbnail = (filePath) =>
  Sender.postWithPromise('/api/thumbnail/get_for_zip', { filePath });

export const getFolderListThumbnails = (dirs) =>
  Sender.postWithPromise('/api/thumbnail/get_for_folder_list', { dirs });

export const pregenerateThumbnails = (payload) =>
  Sender.postWithPromise('/api/pregenerateThumbnails', payload);

export const getQuickThumbnail = (filePath) => {
  const query = encodeURIComponent(filePath);
  return Sender.getWithPromise(`/api/thumbnail/get_quick?p=${query}`);
};
