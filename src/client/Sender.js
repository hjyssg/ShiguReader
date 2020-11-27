import 'whatwg-fetch';

const Sender = {};

function attachFunc(res){
    res.isFailed = () =>{
        if(res.json.failed){
            return true;
        }
        return !(res.status === 200 || res.status === 304);
    }
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

    res.json = await res.json();
    attachFunc(res);
    return res;
};


//server will return json
Sender.post = function (api, body, callback) {
    if(!callback){
        throw "no callback function"
    }

    (async ()=>{

       const res = await  fetch(api, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        res.json = await res.json()
        attachFunc(res);
        callback(res);
    })();
};

export default Sender;
