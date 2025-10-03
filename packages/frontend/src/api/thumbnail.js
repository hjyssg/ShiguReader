import Sender from '@services/Sender';

export const getTagThumbnail = (payload) =>
  Sender.postWithPromise('/api/thumbnail/get_for_tag', payload);

export const getDetailedThumbnail = (filePath, options = {}) =>
  Sender.postWithPromise('/api/thumbnail/get', { filePath, ...options });


export const getQuickThumbnail = (filePath) =>
  Sender.postWithPromise('/api/thumbnail/get', { filePath, quick: true });

export const getFolderListThumbnails = (dirs) =>
  Sender.postWithPromise('/api/thumbnail/get_for_folder_list', { dirs });

export const pregenerateThumbnails = (payload) =>
  Sender.postWithPromise('/api/pregenerateThumbnails', payload);

