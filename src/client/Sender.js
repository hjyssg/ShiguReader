import _ from "underscore";

const Sender = {};

_.resHandle = function (res) {
    if (res.status === 200) {
        return res.json();
    }
    console.error('[failed]', res.status, res.statusText);
    return { failed: true, res };
};

Sender.post = function (api, body, callback) {
    fetch(api, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    })
    .then(_.resHandle)
    .then(callback);
};

Sender.get = function (api, callback) {
    fetch(api)
    .then(_.resHandle)
    .then(callback);
};

Sender.lsDir = function (body, callback) {
    Sender.post('/api/lsDir', body, callback);
};

export default Sender;
