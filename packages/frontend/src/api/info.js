import Sender from '@services/Sender';

export const getGeneralInfo = () =>
  Sender.getWithPromise('/api/getGeneralInfo');

export const getAllInfo = (payload) =>
  Sender.postWithPromise('/api/info/get_all', payload);

export const getGoodAuthorNames = () =>
  Sender.getWithPromise('/api/getGoodAuthorNames');

export const getAuthors = (payload) =>
  Sender.postWithPromise('/api/get_authors', payload);

export const getTags = (payload) =>
  Sender.postWithPromise('/api/get_tags', payload);
