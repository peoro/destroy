
'use strict';

const destroyed = Symbol(`destroyed`);
const destructor = Symbol(`destructor`);
const destructionChain = Symbol(`destructionChain`);

function errMsg( strings, ...args ) {
	const tokens = [];

	strings.forEach( (str, i)=>{
		tokens.push( str );

		const arg = args[i];
		if( ! arg ) {
			tokens.push( arg );
		} else {
			try {
				tokens.push( arg.toString() );
			}
			catch( err ) {
				tokens.push( `[?]` );
			}
		}
	});

	tokens.pop();
	return tokens.join(``);
}
function errFn() {
	return ()=>errMsg(...arguments);
}

function assert( value, msgFn ) {
	if( ! value ) {
		throw new Error( msgFn() );
	}
}

function noop(){}

function initDestroyable( obj ) {
	assert( ! obj[destructionChain], errFn`trying to re-init a destroyable: ${obj}` );
	Object.defineProperty( obj, destructionChain, {
		configurable: true,
		value: [],
	});

	assert( ! obj[destroyed], errFn`trying to re-init an object that was already destroyed: ${obj}` );
	Object.defineProperty( obj, destroyed, {
		configurable: true,
		value: false
	});
}

class NullDestroyable {
	constructor() {
		this[destroyed] = false;
	}
}
class LightDestroyable {
	constructor( fn=noop ) {
		this[destroyed] = false;
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
	if( obj && obj.hasOwnProperty(destroyed) ) {
		if( obj[destroyed] ) {
			return false; // already destroyed
		}

		if( obj[destructor] ) {
			obj[destructor]( destroy );
		}

		Object.defineProperty( obj, destroyed, {
			configurable: true,
			value: true,
		});

		if( obj[destructionChain] ) {
			const chain = obj[destructionChain];
			Object.defineProperty( obj, destructionChain, {
				configurable: true,
				value: [],
			});
			chain.forEach( (link)=>destroy(link) );
		}

		return true;
	}
	return false;
}

function chainDestroy( obj, chainedObj ) {
	assert( obj[destructionChain], errFn`${obj} used as a Destroyable, but it's not` );
	assert( ! obj[destructionChain].includes( chainedObj ), errFn`Trying to destroy ${chainedObj} after ${obj} twice` );
	obj[destructionChain].push( chainedObj );
	assert( ! obj[destroyed], errFn`Tryng to chain ${chainedObj} to ${obj}, but it has already been destroyed ` );
	return obj;
}
function unchainDestroy( obj, chainedObj ) {
	// TODO: use a faster algorithm
	const index = obj[destructionChain].indexOf( chainedObj );
	if( index !== -1 ) {
		obj[destructionChain].splice( index, 1 );
	}
}
function destroyWith( chainedObj, obj ) {
	chainDestroy( obj, chainedObj );
	return chainedObj;
}
function onDestroy( obj, fn ) {
	chainDestroy( obj, new LightDestroyable(fn) );
	return obj;
}

const manualClean = {
	chainDestroy( obj, chainedObj ) {
		chainDestroy( obj, chainedObj );
		return new LightDestroyable( ()=>unchainDestroy(obj, chainedObj) );
	},
	destroyWith( chainedObj, obj ) {
		return manualClean.chainDestroy( obj, chainedObj );
	},
	onDestroy( obj, fn ) {
		return manualClean.chainDestroy( obj, new LightDestroyable(fn) );
	},
};

const clean = {
	chainDestroy( obj, chainedObj ) {
		onDestroy( chainedObj, ()=>unchainDestroy(obj, chainedObj) );
		return chainDestroy( obj, chainedObj );
	},
	destroyWith( chainedObj, obj ) {
		clean.chainDestroy( obj, chainedObj );
		return chainedObj;
	},
};


function isDestroyed( obj ) {
	return !! obj[destroyed];
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
	destroyed,
	destructor,
	destructionChain,

	noop,
	initDestroyable,
	NullDestroyable,
	LightDestroyable,
	Destroyable,

	destroy,
	chainDestroy,
	unchainDestroy,
	destroyWith,
	onDestroy,
	isDestroyed,
	use,

	clean,
	manualClean,
};
