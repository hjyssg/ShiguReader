import Sender from '@services/Sender';

export const getQueue = () =>
  Sender.postWithPromise('/api/minify/get_minify_queue', {});

export const overwrite = (filePath) =>
  Sender.postWithPromise('/api/minify/overwrite', { filePath });

export const requestMinify = (filePath) =>
  Sender.postWithPromise('/api/minify/minify', { filePath });

export const checkMinifyable = (filePath) =>
  Sender.postWithPromise('/api/isAbleToMinify', { filePath });
