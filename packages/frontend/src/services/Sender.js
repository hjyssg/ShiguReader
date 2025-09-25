import 'whatwg-fetch';

const Sender = {};

function attachFunc(res) {
    res.isFailed = () => {
        if (res.json && res.json.failed) {
            return true;
        }
        return !(res.status === 200 || res.status === 304);
    }
}


const getWithPromise = Sender.getWithPromise = async function (api) {
    // Request with GET/HEAD method cannot have body.
    const res = await fetch(api, {
        method: 'GET',
        // headers: {
        //     Accept: 'application/json',
        //     'Content-Type': 'application/json',
        // },
    });

    try {
        //e.g when 504, there is no json, will throw a error
        res.json = await res.json();
    } catch (e) {
        res.json = { failed: true }
    }

    attachFunc(res);
    return res;
};

const postWithPromise = Sender.postWithPromise = async function (api, body) {
    body = body||{};
    const res = await fetch(api, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    });

    try {
        //e.g when 504, there is no json, will throw a error
        res.json = await res.json();
    } catch (e) {
        res.json = { failed: true }
    }

    attachFunc(res);
    return res;
};


//server will return json
Sender.post = async function (api, body, callback) {
    if (!callback) {
        throw "no callback function"
    }
    const res = await postWithPromise(api, body);
    callback(res);
};

//server will return json
Sender.get = async function (api,  callback) {
    if (!callback) {
        throw "no callback function"
    }
    const res = await getWithPromise(api);
    callback(res);
};

export default Sender;
