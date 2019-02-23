
'use strict';

const assert = require('assert');
const sinon = require('sinon');

const {destructor, destructionChain, initDestroyable, NullDestroyable, LightDestroyable, Destroyable, destroy, chainDestroy, unchainDestroy, destroyWith, onDestroy, isDestroyed, use, clean, manualClean} = require('../src/index.js');

function noop1(){}
function noop2(){}
function noop3(){}

describe( `@peoro/destroy`, function(){
	describe( `initDestroyable`, function(){
		const obj = {};
		assert.strictEqual( obj[destructionChain], undefined );
		initDestroyable( obj );
		assert.deepStrictEqual( obj[destructionChain], [] );
		assert.throws(
			()=>initDestroyable(obj),
			new Error(`trying to re-init a destroyable: [object Object]`)
		);
	});
	describe( `LightDestroyable`, function(){
		it(`new LightDestroyable()`, function(){
			const dest = new LightDestroyable();
			assert.strictEqual( typeof dest[destructor], 'function' );
			assert.strictEqual( dest[destructionChain], undefined );
		});
		it(`new LightDestroyable( fn )`, function(){
			function fn(){}
			const dest = new LightDestroyable( fn );
			assert.strictEqual( dest[destructor], fn );
			assert.strictEqual( dest[destructionChain], undefined );
		});
	});
	describe( `Destroyable`, function(){
		it(`new Destroyable()`, function(){
			const dest = new Destroyable();
			assert.strictEqual( typeof dest[destructor], 'function' );
			assert.deepStrictEqual( dest[destructionChain], [] );
		});
		it(`new Destroyable( fn )`, function(){
			function fn(){}
			const dest = new Destroyable( fn );
			assert.strictEqual( dest[destructor], fn );
			assert.deepStrictEqual( dest[destructionChain], [] );
		});
	});

	it(`destroy(), isDestroyed()`, function(){
		// these should do nothing
		destroy( null );
		destroy( `hey` );
		destroy( {} );
		destroy( new Destroyable() );

		// `destructor` is called
		{
			const spy = sinon.spy();
			let res;

			const dest = new Destroyable( spy );
			assert.strictEqual( isDestroyed(dest), false );

			res = destroy( dest );
			assert.strictEqual( res, true );
			assert( spy.calledOnce );
			assert.strictEqual( isDestroyed(dest), true );

			res = destroy( dest );
			assert.strictEqual( res, false );
			assert( spy.calledOnce );
			assert.strictEqual( isDestroyed(dest), true );

			assert( spy.alwaysCalledWithExactly(destroy) );
		}

		// `NullDestroyable` works too
		{
			const spy = sinon.spy();
			const chainDest = new LightDestroyable( spy );
			let res;

			const dest = new Destroyable();
			assert.strictEqual( isDestroyed(dest), false );

			dest[destructionChain].push( chainDest, chainDest );
			assert( spy.notCalled );
			assert.strictEqual( isDestroyed(dest), false );

			res = destroy( dest );
			assert.strictEqual( res, true );
			assert( spy.calledOnce );
			assert.strictEqual( isDestroyed(dest), true );

			// `spy` is not called again
			res = destroy( dest );
			assert.strictEqual( res, false );
			assert( spy.calledOnce );
			assert.strictEqual( isDestroyed(dest), true );

			assert( spy.alwaysCalledWithExactly(destroy) );
		}

		// custom destroyables work too
		{
			let res;

			const dest = new NullDestroyable();
			assert.strictEqual( isDestroyed(dest), false );

			res = destroy( dest );
			assert.strictEqual( res, true );
			assert.strictEqual( isDestroyed(dest), true );

			res = destroy( dest );
			assert.strictEqual( res, false );
			assert.strictEqual( isDestroyed(dest), true );
		}
	});

	it(`chainDestroy()`, function(){
		const chainDest1 = new Destroyable(noop1);
		const chainDest2 = new LightDestroyable(noop2);
		const lightDest = new LightDestroyable();
		const dest = new Destroyable();

		assert.throws(
			()=>chainDestroy(lightDest, chainDest1),
			new Error(`[object Object] used as a Destroyable, but it's not`)
		);
		chainDestroy( dest, chainDest1 );
		assert.deepStrictEqual( dest[destructionChain], [chainDest1] );

		const res = chainDestroy( dest, chainDest2 );
		assert.strictEqual( res, dest );
		assert.deepStrictEqual( dest[destructionChain], [chainDest1, chainDest2] );
	});

	it(`unchainDestroy()`, function(){
		const chainDest1 = new Destroyable(noop1);
		const chainDest2 = new LightDestroyable(noop2);
		const chainDest3 = new Destroyable(noop3);
		const dest = new Destroyable();

		chainDestroy( dest, chainDest1 );
		chainDestroy( dest, chainDest2 );
		chainDestroy( dest, chainDest3 );
		assert.deepStrictEqual( dest[destructionChain], [chainDest1, chainDest2, chainDest3] );

		unchainDestroy( dest, chainDest1 );
		assert.deepStrictEqual( dest[destructionChain], [chainDest2, chainDest3] );

		unchainDestroy( dest, chainDest1 );
		assert.deepStrictEqual( dest[destructionChain], [chainDest2, chainDest3] );

		unchainDestroy( dest, chainDest3 );
		assert.deepStrictEqual( dest[destructionChain], [chainDest2] );

		unchainDestroy( dest, null );
		assert.deepStrictEqual( dest[destructionChain], [chainDest2] );
	});

	it(`destroyWith()`, function(){
		const chainDest1 = new Destroyable(noop1);
		const chainDest2 = new Destroyable(noop2);
		const dest = new Destroyable();

		const res = destroyWith( chainDest1, dest );
		assert.strictEqual( res, chainDest1 );
		assert.deepStrictEqual( dest[destructionChain], [chainDest1] );

		destroyWith( chainDest2, dest );
		assert.deepStrictEqual( dest[destructionChain], [chainDest1, chainDest2] );
	});

	it(`onDestroy()`, function(){
		const dest = new Destroyable();

		const res = onDestroy( dest, noop1 );
		assert.strictEqual( res, dest );
		assert.deepEqual( dest[destructionChain].length, 1 );
		assert.deepEqual( dest[destructionChain][0][destructor], noop1 );

		onDestroy( dest, noop2 );
		assert.deepEqual( dest[destructionChain].length, 2 );
		assert.deepEqual( dest[destructionChain][1][destructor], noop2 );
	});

	it(`use()`, function(){
		const spy = sinon.spy();
		const mkDest = (x)=>{
			const dest = new Destroyable( spy );
			dest.data = x;
			return dest;
		};

		// don't throw
		use( mkDest(`hey`), (dest)=>{
			assert.deepEqual( dest.data, `hey` );
			assert( spy.notCalled );
		});
		assert( spy.calledOnce );

		// throw
		const err = new Error(`Test`);
		assert.throws(
			()=>{
				use( mkDest(`yo`), (dest)=>{
					assert.deepEqual( dest.data, `yo` );
					assert( spy.calledOnce );
					throw err;
				});
			},
			err
		);
		assert( spy.calledTwice );
	});

	it(`Error messages are formatted correctly`, function(){
		const obj = {
			toString(){
				throw new Error(`Can't be stringified`);
			}
		};

		initDestroyable( obj );
		assert.throws(
			()=>initDestroyable(obj),
			new Error(`trying to re-init a destroyable: [?]`)
		);
	});

	describe(`clean`, function(){
		it(`chainDestroy()`, function(){
			const chainDest1 = new Destroyable(noop1);
			const chainDest2 = new Destroyable(noop1);
			const dest = new Destroyable();

			const res = clean.chainDestroy( dest, chainDest1 );
			assert.strictEqual( res, dest );

			clean.chainDestroy( dest, chainDest2 );
			assert.deepStrictEqual( dest[destructionChain], [chainDest1, chainDest2] );

			destroy( chainDest1 );
			assert.deepStrictEqual( dest[destructionChain], [chainDest2] );
		});
		it(`destroyWith()`, function(){
			const chainDest1 = new Destroyable(noop1);
			const chainDest2 = new Destroyable(noop1);
			const dest = new Destroyable();

			const res = clean.destroyWith( chainDest1, dest );
			assert.strictEqual( res, chainDest1 );

			clean.destroyWith( chainDest2, dest );
			assert.deepStrictEqual( dest[destructionChain], [chainDest1, chainDest2] );

			destroy( chainDest1 );
			assert.deepStrictEqual( dest[destructionChain], [chainDest2] );
		});
	});

	describe(`manualClean`, function(){
		it(`chainDestroy()`, function(){
			const chainDest1 = new Destroyable(noop1);
			const chainDest2 = new Destroyable(noop1);
			const dest = new Destroyable();

			const handle = manualClean.chainDestroy( dest, chainDest1 );
			manualClean.chainDestroy( dest, chainDest2 );
			assert.deepStrictEqual( dest[destructionChain], [chainDest1, chainDest2] );

			destroy( handle );
			assert.deepStrictEqual( dest[destructionChain], [chainDest2] );
		});
		it(`destroyWith()`, function(){
			const chainDest1 = new Destroyable(noop1);
			const chainDest2 = new Destroyable(noop1);
			const dest = new Destroyable();

			const handle = manualClean.destroyWith( chainDest1, dest );

			manualClean.destroyWith( chainDest2, dest );
			assert.deepStrictEqual( dest[destructionChain], [chainDest1, chainDest2] );

			destroy( handle );
			assert.deepStrictEqual( dest[destructionChain], [chainDest2] );
		});
		it(`onDestroy()`, function(){
			const dest = new Destroyable();

			const handle = manualClean.onDestroy( dest, noop1 );
			assert.deepEqual( dest[destructionChain].length, 1 );
			assert.deepEqual( dest[destructionChain][0][destructor], noop1 );

			onDestroy( dest, noop2 );
			assert.deepEqual( dest[destructionChain].length, 2 );
			assert.deepEqual( dest[destructionChain][1][destructor], noop2 );

			destroy( handle );
			assert.deepEqual( dest[destructionChain].length, 1 );
			assert.deepEqual( dest[destructionChain][0][destructor], noop2 );
		});
	});
});
