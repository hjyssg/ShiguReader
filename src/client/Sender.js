import _ from "underscore";

const Sender = {};

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

Sender.lsDir = function (body, callback) {
    Sender.post('/api/lsDir', body, callback);
};

export default Sender;
