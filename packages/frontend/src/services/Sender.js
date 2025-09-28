import 'whatwg-fetch';
import axios from 'axios';

const Sender = {};

const createClient = () => axios.create({
    validateStatus: () => true,
});

let httpClient = createClient();

const ensureJson = (data) => {
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

function attachFunc(res) {
    res.isFailed = () => {
        if (res.json && res.json.failed) {
            return true;
        }
        return !(res.status === 200 || res.status === 304);
    };
}

const buildResponse = (status, data, extra = {}) => {
    const res = {
        status,
        json: data,
        ...extra,
    };

    attachFunc(res);
    return res;
};

const performRequest = async (config) => {
    try {
        const axiosRes = await httpClient(config);
        const json = ensureJson(axiosRes.data);
        return buildResponse(axiosRes.status, json);
    } catch (error) {
        const response = error && error.response || {};
        const status = response.status || 0;
        const hasResponseData = response && Object.prototype.hasOwnProperty.call(response, 'data');
        const fallback = { failed: true };
        if (error && error.message) {
            fallback.reason = error.message;
        }
        const json = hasResponseData ? ensureJson(response.data) : fallback;
        return buildResponse(status, json, { error });
    }
};

const getWithPromise = Sender.getWithPromise = async function (api) {
    const res = await performRequest({
        url: api,
        method: 'get',
    });

    return res;
};

const postWithPromise = Sender.postWithPromise = async function (api, body) {
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
};

//server will return json
Sender.post = async function (api, body, callback) {
    if (!callback) {
        throw "no callback function";
    }
    const res = await postWithPromise(api, body);
    callback(res);
};

//server will return json
Sender.get = async function (api, callback) {
    if (!callback) {
        throw "no callback function";
    }
    const res = await getWithPromise(api);
    callback(res);
};

export const __setHttpClient = (client) => {
    httpClient = client;
};

export const __resetHttpClient = () => {
    httpClient = createClient();
};

export default Sender;
