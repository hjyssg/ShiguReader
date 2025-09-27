import Sender from '@services/Sender';

export const extractZip = ({ filePath, startIndex = 0 }) =>
  Sender.postWithPromise('/api/extract/extract_zip', { filePath, startIndex });
