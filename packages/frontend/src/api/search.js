import Sender from '@services/Sender';

export const searchFiles = (params) =>
  Sender.postWithPromise('/api/search/search_file', params);
