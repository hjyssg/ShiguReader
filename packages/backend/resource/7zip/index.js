var resolve = require('path').resolve
var bin = require('./package').bin

module.exports = map_obj(bin, function(v){
  let result = resolve(__dirname, v);
  console.log("[DEBUG] 7Zpath", result);
  return result;
})

function map_obj(obj, fn){
  return Object.keys(obj).reduce(function(m, k){
    m[k] = fn(obj[k])
    return m
  }, {})
}
