'use strict';

var _ = require('underscore');
var omitEmpty = require('omit-empty');
var wildstring = require('wildstring');

var ObjectNode = module.exports = function(parentNode, nodeName, sep) {
	this._sep = sep || '.';
	this._parentNode = parentNode;
	this._nodeName = nodeName;
	this._path = [];
	this._properties = {};

	if (nodeName) {
		this._path.push(nodeName);
	}

	if (parentNode) {
		this._path.unshift.apply(this._path, this._parentNode._path);
	}
};

var proto = ObjectNode.prototype;

proto.toObject = function(options) {
	options = options || {};

	var keys = _.keys(this._properties);
	var plainObject = {};

	_.forEach(keys, function(key) {
		// skip private properties
		// if (key.indexOf('_') === 0) {
		// 	return;
		// }

		var child = this.get(key);
		var ignore = false;
		var path = child instanceof ObjectNode ?
				child.pathOf() : this.pathOf(key);

		if (options.check) {
			var existed = _.find(options.check, function(pattern) {
				try {
					return wildstring.match(pattern, path);
				} catch (e) {
					return false;
				}
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

	return this._parentNode && !options.omitEmpty ?
			plainObject : omitEmpty(plainObject);
};

proto.get = function(path, createIfNull) {
	if (!path || typeof path !== 'string') {
		return null;
	}

	var frags = path.split(this._sep);

	var firstFrag = frags.shift();

	var child = this._properties[firstFrag];

	if (frags.length === 0) {
		if (createIfNull && !child) {
			child = new ObjectNode(this, firstFrag, this._sep);
			this.set(firstFrag, child);
		}

		return child;
	}

	if (!child) {
		if (!createIfNull) {
			return null;
		}

		child = new ObjectNode(this, firstFrag, this._sep);
		this.set(firstFrag, child);
	}

	return child.get(frags.join(this._sep), createIfNull);
};

proto.set = function(path, value) {
	if (!path || typeof path !== 'string') {
		return null;
	}

	var frags = path.split(this._sep);
	var firstFrag = frags.shift();

	if (!firstFrag) {
		return;
	}

	if (frags.length === 0) {
		this._properties[firstFrag] = value;

		return;
	}

	var child = this._properties[firstFrag];

	if (!(child instanceof ObjectNode)) {
		child = this._properties[firstFrag] = new ObjectNode(this, firstFrag, this._sep);
	}

	child.set(frags.join(this._sep), value);
};

proto.pathOf = function(key, asArray) {
	if (!key) {
		return asArray ? this._path : this._path.join(this._sep);
	}

	var frags = key.split(this._sep);

	var lastFrag = frags.pop();

	if (!lastFrag) {
		return asArray ? this._path : this._path.join(this._sep);
	}

	if (frags.length === 0) {
		if (typeof this._properties[lastFrag] === 'undefined' || this._properties[lastFrag] === null) {
			return null;
		}

		var arr = [];
		arr.push.apply(arr, this._path);
		arr.push(lastFrag);

		return asArray ? arr : arr.join(this._sep);
	}

	var child = this.get(frags.join(this._sep));

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
				child = new ObjectNode(this, key, this._sep);
				this.set(key, child);
			}

			child.extend(value);
		} else {
			this.set(key, value);
		}
	}.bind(node));

	return this;
};
