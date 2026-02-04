import axios, { AxiosRequestConfig } from 'axios';
import { ApiResponse } from '@common';

const createClient = () => axios.create({
    validateStatus: () => true,
});

let httpClient = createClient();

const ensureJson = (data: any): any => {
    if (data === null || data === undefined) {
        return { failed: true };
    }

    if (typeof data === 'string') {
        if (!data.trim()) {
            return { failed: true };
        }

        try {
            return JSON.parse(data);
        } catch (e) {
            return { failed: true };
        }
    }

    return data;
};

function attachFunc(res: any) {
    res.isFailed = () => {
        if (res.json && res.json.failed) {
            return true;
        }
        return !(res.status === 200 || res.status === 304);
    };
}

const buildResponse = (status: number, data: any, extra = {}): ApiResponse<any> => {
    const res = {
        status,
        json: data,
        ...extra,
    };

    attachFunc(res);
    return res as ApiResponse<any>;
};

const performRequest = async (config: AxiosRequestConfig): Promise<ApiResponse<any>> => {
    try {
        const axiosRes = await httpClient(config);
        const json = ensureJson(axiosRes.data);
        return buildResponse(axiosRes.status, json);
    } catch (error: any) {
        const response = error && error.response || {};
        const status = response.status || 0;
        const hasResponseData = response && Object.prototype.hasOwnProperty.call(response, 'data');
        const fallback = { failed: true };
        if (error && error.message) {
            (fallback as any).reason = error.message;
        }
        const json = hasResponseData ? ensureJson(response.data) : fallback;
        return buildResponse(status, json, { error });
    }
};

const Sender = {
    getWithPromise: async function (api: string): Promise<ApiResponse<any>> {
        const res = await performRequest({
            url: api,
            method: 'get',
        });
        return res;
    },

    postWithPromise: async function (api: string, body?: any): Promise<ApiResponse<any>> {
        const res = await performRequest({
            url: api,
            method: 'post',
            data: body === undefined ? {} : body,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });
        return res;
    },

    post: async function (api: string, body: any, callback: (res: ApiResponse<any>) => void) {
        if (!callback) {
            throw "no callback function";
        }
        const res = await this.postWithPromise(api, body);
        callback(res);
    },

    get: async function (api: string, callback: (res: ApiResponse<any>) => void) {
        if (!callback) {
            throw "no callback function";
        }
        const res = await this.getWithPromise(api);
        callback(res);
    }
};

export const getWithPromise = Sender.getWithPromise;
export const postWithPromise = Sender.postWithPromise;

export const __setHttpClient = (client: any) => {
    httpClient = client;
};

export const __resetHttpClient = () => {
    httpClient = createClient();
};

export default Sender;
