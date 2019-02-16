
'use strict';

const assert = require('assert');
const destructor = Symbol(`destructor`);
const destructionChain = Symbol(`destructionChain`);

function noop(){}

function initDestroyable( obj ) {
	assert( ! obj[destructionChain], `trying to re-init a destroyable` );
	Object.defineProperty( obj, destructionChain, {
		configurable: true,
		value: [],
	});
}

class LightDestroyable {
	constructor( fn=noop ) {
		this[destructor] = fn;
	}
}
class Destroyable {
	constructor( fn=noop ) {
		initDestroyable( this );
		this[destructor] = fn;
	}
}

function destroy( obj ) {
	if( obj ) {
		if( obj[destructor] ) {
			obj[destructor]( destroy );
		}
		if( obj[destructionChain] ) {
			const chain = obj[destructionChain];
			Object.defineProperty( obj, destructionChain, {
				configurable: true,
				value: [],
			});
			chain.forEach( (link)=>destroy(link) );
		}
	}
}

function chainDestroy( obj, chainedObj ) {
	obj[destructionChain].push( chainedObj );
	return obj;
}
function chainDestroyArr( obj, chainedObjs ) {
	return chainedObjs.reduce( chainDestroy, obj );
}
function destroyWith( chainedObj, obj ) {
	chainDestroy( obj, chainedObj );
	return chainedObj;
}
function onDestroy( obj, fn ) {
	chainDestroy( obj, new LightDestroyable(fn) );
	return obj;
}

function use( destroyable, fn ) {
	try {
		return fn( destroyable );
	}
	finally {
		destroy( destroyable );
	}
}


module.exports = {
	destructor,
	destructionChain,

	noop,
	initDestroyable,
	LightDestroyable,
	Destroyable,

	destroy,
	chainDestroy,
	chainDestroyArr,
	destroyWith,
	onDestroy,
	use,
};
