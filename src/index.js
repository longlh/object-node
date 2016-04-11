'use strict';

var _ = require('underscore');
var omitEmpty = require('omit-empty');
var wildstring = require('wildstring');

var ObjectNode = module.exports = function(parentNode, nodeName) {
	this._parentNode = parentNode;
	this._nodeName = nodeName;
	this._path = [];

	if (nodeName) {
		this._path.push(nodeName);
	}

	if (parentNode) {
		this._path.unshift.apply(this._path, this._parentNode._path);
	}
};

var proto = ObjectNode.prototype;

proto.toObject = function(options) {
	var keys = _.keys(this);

	var plainObject = {};

	_.forEach(keys, function(key) {
		// skip private properties
		if (key.indexOf('_') === 0) {
			return;
		}

		var child = this.get(key);
		var ignore = false;
		var path = child instanceof ObjectNode ?
				child.pathOf() : this.pathOf(key);

		if (options && options.check) {
			var existed = _.find(options.check, function(pattern) {
				return wildstring.match(pattern, path);
			});

			if (options.mode === 'pick') {
				ignore = !existed;
			} else if (options.mode === 'omit') {
				ignore = existed;
			}
		}

		plainObject[key] = child instanceof ObjectNode ?
				child.toObject(options) :
				(ignore ? undefined : child);
	}.bind(this));

	return this._parentNode ?
			plainObject : omitEmpty(plainObject);
};

proto.get = function(path, createIfNull) {
	if (!path || typeof path !== 'string') {
		return null;
	}

	var frags = path.split('.');

	var firstFrag = frags.shift();

	var child = this[firstFrag];

	if (frags.length === 0) {
		if (createIfNull && !child) {
			child = new ObjectNode(this, firstFrag);
			this.set(firstFrag, child);
		}

		return child;
	}

	if (!child) {
		if (!createIfNull) {
			return null;
		}

		child = new ObjectNode(this, firstFrag);
		this.set(firstFrag, child);
	}

	return child.get(frags.join('.'), createIfNull);
};

proto.set = function(path, value) {
	if (!path || typeof path !== 'string') {
		return null;
	}

	var frags = path.split('.');
	var firstFrag = frags.shift();

	if (!firstFrag) {
		return;
	}

	if (frags.length === 0) {
		this[firstFrag] = value;

		return;
	}

	var child = this[firstFrag];

	if (!(child instanceof ObjectNode)) {
		child = this[firstFrag] = new ObjectNode(this, firstFrag);
	}

	child.set(frags.join('.'), value);
};

proto.pathOf = function(key, asArray) {
	if (!key) {
		return asArray ? this._path : this._path.join('.');
	}

	var frags = key.split('.');

	var lastFrag = frags.pop();

	if (!lastFrag) {
		return asArray ? this._path : this._path.join('.');
	}

	if (frags.length === 0) {
		if (typeof this[lastFrag] === 'undefined') {
			return null;
		}

		var arr = [];
		arr.push.apply(arr, this._path);
		arr.push(lastFrag);

		return asArray ? arr : arr.join('.');
	}

	var child = this.get(frags.join('.'));

	return child ? child.pathOf(lastFrag, asArray) : null;
};

proto.extend = function(plainObject, path) {
	var keys = _.keys(plainObject);

	var node = path ? this.get(path, true) : this;

	_.forEach(keys, function(key) {
		var value = plainObject[key];

		if (value && typeof value === 'object' && !_.isArray(value)) {
			var child = this.get(key);

			if (!(child instanceof ObjectNode)) {
				child = new ObjectNode(this, key);
				this.set(key, child);
			}

			child.extend(value);
		} else {
			this.set(key, value);
		}
	}.bind(node));

	return this;
};
