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


const postWithPromise = Sender.postWithPromise = async function (api, body) {
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

export default Sender;
