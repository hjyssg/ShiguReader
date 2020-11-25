import _ from "underscore";
import 'whatwg-fetch';

const Sender = {};

function isSuccess(res){
    return res.status === 200 || res.status === 304
}

_.resHandle = function (res) {
    if (isSuccess(res)) {
        return res.json();
    }else{
        res.failed = true;
        return res;
    }
};

//server will return status code and text
//not json
Sender.simplePost = function (api, body, callback) {
    fetch(api, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    })
    .then(res => {
        if(!(isSuccess(res))){
            res.failed = true;
        }
        return res;
    }).then(callback);;
};

//server will return json
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
