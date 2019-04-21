fetch("http://localhost:8080/api/exhentaiApi", {
  method: 'POST',
  mode: 'no-cors',
  headers: {
    'Access-Control-Allow-Origin':'*'
  }
}).then(function(res){
    console.log(res)
})

.then(function(res) {
    debugger
    console.log(res);
})