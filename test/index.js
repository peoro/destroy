
'use strict';

const assert = require('assert');
const sinon = require('sinon');

const {destructor, destructionChain, initDestroyable, LightDestroyable, Destroyable, destroy, chainDestroy, destroyWith, onDestroy, use} = require('../src/index.js');

function noop1(){}
function noop2(){}

describe( `@peoro/destroy`, function(){
	describe( `initDestroyable`, function(){
		const obj = {};
		assert.strictEqual( obj[destructionChain], undefined );
		initDestroyable( obj );
		assert.deepStrictEqual( obj[destructionChain], [] );
		assert.throws( ()=>initDestroyable(obj), /trying to re-init a destroyable/ );
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

	it(`destroy()`, function(){
		// these should do nothing
		destroy( null );
		destroy( `hey` );
		destroy( {} );
		destroy( new Destroyable() );

		// `destructor` is called
		{
			const spy = sinon.spy();
			const dest = new Destroyable( spy );

			destroy( dest );
			assert( spy.calledOnce );

			destroy( dest );
			assert( spy.calledTwice );

			assert( spy.alwaysCalledWithExactly(destroy) );
		}

		// `destructionChain` works
		{
			const spy = sinon.spy();
			const chainDest = new Destroyable( spy );

			const dest = new Destroyable();
			dest[destructionChain].push( chainDest, chainDest );
			assert( spy.notCalled );

			destroy( dest );
			assert( spy.calledTwice );
			assert( spy.alwaysCalledWithExactly(destroy) );

			// `spy` is not called again
			destroy( dest );
			assert( spy.calledTwice );
		}
	});

	it(`chainDestroy()`, function(){
		const chainDest1 = new Destroyable(noop1);
		const chainDest2 = new Destroyable(noop2);
		const dest = new LightDestroyable();

		chainDestroy( dest, chainDest1 );
		assert.deepStrictEqual( dest[destructionChain], [chainDest1] );

		chainDestroy( dest, chainDest2 );
		assert.deepStrictEqual( dest[destructionChain], [chainDest1, chainDest2] );
	});

	it(`destroyWith()`, function(){
		const chainDest1 = new Destroyable(noop1);
		const chainDest2 = new Destroyable(noop2);
		const dest = new Destroyable();

		destroyWith( chainDest1, dest );
		assert.deepStrictEqual( dest[destructionChain], [chainDest1] );

		destroyWith( chainDest2, dest );
		assert.deepStrictEqual( dest[destructionChain], [chainDest1, chainDest2] );
	});

	it(`onDestroy()`, function(){
		const dest = new Destroyable();

		onDestroy( dest, noop1 );
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
		const err = new Error();
		assert.throws( ()=>{
			use( mkDest(`yo`), (dest)=>{
				assert.deepEqual( dest.data, `yo` );
				assert( spy.calledOnce );
				throw err;
			});
		}, err );
		assert( spy.calledTwice );
	});
});
