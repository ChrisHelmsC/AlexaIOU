'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

const assert = require('assert');

describe('index', () => {
    before(() => {
        this.index = require('../src/index.js');
    });
    describe('#handler', () => {
        it('should be a function', () => {
            assert.equal(typeof this.index.handler, 'function');
        });
    });
});