import Sender from '@services/Sender';

export const shutdownServer = () =>
  Sender.postWithPromise('/api/shutdownServer', {});
