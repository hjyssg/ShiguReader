import Sender from '@services/Sender';

export const getCacheInfo = () =>
  Sender.postWithPromise('/api/cache/get_info', {});

export const cleanCache = () =>
  Sender.postWithPromise('/api/cleanCache', {});
