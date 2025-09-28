import Sender from '@services/Sender';

export const searchFiles = (params) =>
  Sender.postWithPromise('/api/search/search_file', params);

export const findSimilarFiles = (text) => {
  const query = encodeURIComponent(text || '');
  return Sender.postWithPromise(`/api/search/find_similar_file/${query}`);
};
