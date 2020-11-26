import 'whatwg-fetch';

const Sender = {};

function isSuccess(res){
    return res.status === 200 || res.status === 304
}

Sender.postWithPromise = async function (api, body) {
    const res = await  fetch(api, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    });

    res.failed = !isSuccess(res);
    return res;
};

//server will return status code and text
//not json
Sender.simplePost = function (api, body, callback) {
    (async ()=>{

        const res = await  fetch(api, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if(isSuccess(res)){
           callback({
                failed: false
           });
        }else{
            res.failed = true;
            const text = await res.text();
            res.text = text;
            callback(res);
        }
    })();
};

//server will return json
Sender.post = function (api, body, callback) {
    (async ()=>{

       const res = await  fetch(api, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if(isSuccess(res)){
           const json = await res.json();
           callback(json);
        }else{
            res.failed = true;
            callback(res);
        }

    })();
};


Sender.lsDir = function (body, callback) {
    Sender.post('/api/lsDir', body, callback);
};

export default Sender;
