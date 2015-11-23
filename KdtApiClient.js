var crypto = require('crypto');
var request = require('request');
var path = require('path');
var fs = require('fs');
var querystring = require('querystring');

var KdtApiProtocol = function() {
}
KdtApiProtocol.APP_ID_KEY = 'app_id';
KdtApiProtocol.METHOD_KEY = 'method';
KdtApiProtocol.TIMESTAMP_KEY = 'timestamp';
KdtApiProtocol.FORMAT_KEY = 'format';
KdtApiProtocol.VERSION_KEY = 'v';
KdtApiProtocol.SIGN_KEY = 'sign';
KdtApiProtocol.SIGN_METHOD_KEY = 'sign_method';
KdtApiProtocol.AllowedSignMethods = function() {
	return ['md5'];
}
KdtApiProtocol.AllowedFormats = function() {
	return ['json'];
}
KdtApiProtocol.Sign = function(app_secret, params, method) {
	method = method || 'md5';
	params = params || {};
	var keys = Object.keys(params).sort();
	var text = '';
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		text += (key + params[key]);
	}
	
	return KdtApiProtocol.hash(method, [app_secret, text, app_secret].join(''));
}
KdtApiProtocol.hash = function(method, text) {
	var signature = '';
	switch (method) {
	case 'md5':
	default:
	{
		var md5 = crypto.createHash('md5');
		md5.update(new Buffer(text, 'utf8'));
		signature = md5.digest('hex');
	}
	}
	return signature;
}

var KdtApiClient = function(app_id, app_secret) {
	if (!app_id || !app_secret) {
		throw 'app_id and app_secret is compulsory.';
	}
	this.app_id = app_id;
	this.app_secret = app_secret;
	this.format = 'json';
	this.sign_method = 'md5';
}

KdtApiClient.version = '1.0';
KdtApiClient.apiEntry = 'https://open.koudaitong.com/api/entry';
KdtApiClient.prototype.Get = function(method, params, callback) {
	var path = KdtApiClient.apiEntry + '?' + querystring.stringify(this.build(method, params));
	var data = '';
	request.get(path, function(err, res, body) {
		var response;
		try {
			response = JSON.parse(body);
		} catch (e) {
			callback(err);
			return;
		}
		callback(err, response);
	});
}
KdtApiClient.prototype.Post = function(method, params, files, callback) {
	params = this.build(method, params);
	console.log(params);
	var formData = {};
	for (var key in params) {
		formData[key] = params[key];
	}
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		if (!file.path && !file.content) {
			continue;
		}
		var field = file.field || 'images[]';
		var filename = 'file' + i + path.extname(file.path || 'a.png');
		if (field in formData) {
			if (!(formData[field] instanceof Array)) {
				formData[field] = [formData[field]]
			}
			formData[field].push(fs.createReadStream(file.path))
			continue;
		}
		formData[field] = fs.createReadStream(file.path);
	}
	request.post({
		url: KdtApiClient.apiEntry, 
		formData: formData
	}, function(err, res, body) {
		var response;
		try {
			response = JSON.parse(body);
		} catch (e) {
			callback(err);
			return;
		}
		callback(err, response);
	});
}
KdtApiClient.prototype.SetFormat = function(format) {
	if (KdtApiProtocol.AllowedFormats().indexOf(format) < 0) {
		throw 'Invalid data format.';
	}
	this.format = format;
}
KdtApiClient.prototype.SetSignMethod = function(method) {
	if (KdtApiProtocol.AllowedSignMethods().indexOf(method) < 0) {
		throw 'Invalid sign method.';
	}
	this.sign_method = method;
}
KdtApiClient.prototype.build = function(method, api_params) {
	var params = {}
	params[KdtApiProtocol.APP_ID_KEY] = this.app_id;
	params[KdtApiProtocol.METHOD_KEY] = method;
	params[KdtApiProtocol.TIMESTAMP_KEY] = new Date(Date.now() + 8 * 3600000).toISOString().replace(/T/, ' ').replace(/\..+/, '');
	params[KdtApiProtocol.FORMAT_KEY] = this.format;
	params[KdtApiProtocol.SIGN_METHOD_KEY] = this.sign_method;
	params[KdtApiProtocol.VERSION_KEY] = KdtApiClient.version;
	api_params = api_params || {}
	for (var key in api_params) {
		if (key in params) {
			throw 'Conflict parameters.'
		}
		params[key] = api_params[key];
	}
	params[KdtApiProtocol.SIGN_KEY] = KdtApiProtocol.Sign(this.app_secret, params, this.sign_method);
	return params;
}

module.exports = KdtApiClient;