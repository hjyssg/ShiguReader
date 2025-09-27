import Sender from '@services/Sender';

export const getHomeDirectories = () =>
  Sender.getWithPromise('/api/homePagePath');
