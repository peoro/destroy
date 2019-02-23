
'use strict';

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
	assert( obj[destructionChain], errFn`${obj} used as a Destroyable, but it's not` );
	assert( ! obj[destructionChain].includes( chainedObj ), errFn`Trying to destroy ${chainedObj} after ${obj} twice` );
	obj[destructionChain].push( chainedObj );
	return obj;
}
function unchainDestroy( obj, chainedObj ) {
	// TODO: use a faster algorithm
	const index = obj[destructionChain].indexOf( chainedObj );
	if( index !== -1 ) {
		obj[destructionChain].splice( index, 1 );
	}
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

const manualClean = {
	chainDestroy( obj, chainedObj ) {
		chainDestroy( obj, chainedObj );
		return new LightDestroyable( ()=>unchainDestroy(obj, chainedObj) );
	},
	chainDestroyArr( obj, chainedObjs ) {
		const handle = new Destroyable();
		chainedObjs.forEach( (obj)=>chainDestroy(handle, obj) );

		return manualClean.chainDestroy( obj, handle );
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
	chainDestroyArr( obj, chainedObjs ) {
		return chainedObjs.reduce( clean.chainDestroy, obj );
	},
	destroyWith( chainedObj, obj ) {
		clean.chainDestroy( obj, chainedObj );
		return chainedObj;
	},
};

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
	unchainDestroy,
	chainDestroyArr,
	destroyWith,
	onDestroy,
	use,

	clean,
	manualClean,
};
