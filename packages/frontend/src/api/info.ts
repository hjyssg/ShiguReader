import Sender from '@services/Sender';
import { ApiResponse, TagResponse, AuthorResponse, GoodAuthorNamesResponse } from '@common';

export const getGeneralInfo = (): Promise<ApiResponse<any>> =>
  Sender.getWithPromise('/api/getGeneralInfo');

export const getAllInfo = (payload: any): Promise<ApiResponse<any>> =>
  Sender.postWithPromise('/api/info/get_all', payload);

export const getGoodAuthorNames = (): Promise<ApiResponse<GoodAuthorNamesResponse>> =>
  Sender.getWithPromise('/api/getGoodAuthorNames');

export const getAuthors = (payload: any): Promise<ApiResponse<AuthorResponse>> =>
  Sender.postWithPromise('/api/get_authors', payload);

export const getTags = (payload: any): Promise<ApiResponse<TagResponse>> =>
  Sender.postWithPromise('/api/get_tags', payload);
