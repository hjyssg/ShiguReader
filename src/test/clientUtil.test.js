const assert = require('assert');
const clientUtil = require('../client/clientUtil');

describe('clientUtil', function() {

  describe('#getSep()', function() {
    it('should return "/" for linux and web url path', function() {
      const result = clientUtil.getSep('/home/user/example.html');
      assert.strictEqual(result, '/');
    });
    it('should return "\\" for windows path', function() {
      const result = clientUtil.getSep('C:\\Users\\user\\example.html');
      assert.strictEqual(result, '\\');
    });
    it('should return "/" for web url', function() {
      const result = clientUtil.getSep('http://www.example.com');
      assert.strictEqual(result, '/');
    });
  });

  describe('#getDir()', function() {
    it('should return the directory path of the file path', function() {
      const result = clientUtil.getDir('C:\\Users\\user\\Documents\\example.html');
      assert.strictEqual(result, 'C:\\Users\\user\\Documents');
    });
    it('should return an empty string if the file path is empty', function() {
      const result = clientUtil.getDir('');
      assert.strictEqual(result, '');
    });
    it('should return the correct directory path with slash separator on Linux', function() {
      const result = clientUtil.getDir('/home/user/example.html');
      assert.strictEqual(result, '/home/user');
    });
  });

  describe('#getBaseName()', function() {
    it('should return the base name of the file path', function() {
      const result = clientUtil.getBaseName('C:\\Users\\user\\Documents\\example.html');
      assert.strictEqual(result, 'example.html');
    });
  
    it('should return an empty string if the file path is empty', function() {
      const result = clientUtil.getBaseName('');
      assert.strictEqual(result, '');
    });
    
  });

  describe('#getBaseNameWithoutExtention()', function() {
    it('should return the base name without the extension of the file name', function() {
      const result = clientUtil.getBaseNameWithoutExtention('C:\\Users\\user\\Documents\\example.html');
      assert.strictEqual(result, 'example');
    });
    it('should return the base name if there is no extension in the file name', function() {
      const result = clientUtil.getBaseNameWithoutExtention('C:\\Users\\user\\noextension');
      assert.strictEqual(result, 'noextension');
    });
    it('should return an empty string if the file name is empty', function() {
      const result = clientUtil.getBaseNameWithoutExtention('');
      assert.strictEqual(result, '');
    });
  });

});
