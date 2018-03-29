import { FingerPrintReader } from '../src/index';
import { expect, assert, should } from 'chai';
import 'mocha';

describe('Fingerprint', () => {
    describe('open', () => {
        it('Should open serial port connection', () => {
            var reader = new FingerPrintReader('/dev/ttyS0');
            return reader.open().then(function() {
                assert(true, "Serial Connection Opened");
            });
        });
    });

});