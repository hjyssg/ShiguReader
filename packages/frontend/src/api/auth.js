import Sender from '@services/Sender';

export const login = (password) =>
  Sender.postWithPromise('/api/auth/login', { password });

export const logout = () =>
  Sender.postWithPromise('/api/auth/logout', {});
