// var fs = require('fs');
import * as fs from 'fs';
import * as async from 'async';
// var async = require('async');
var mkdirp = require('mkdirp');

function isObject(obj: Object) {
    return Object.prototype.toString.call(obj) === '[object Object]';
}

export interface Store {
    [key: string]: any;
}

export class Storage {
    filename: string;
    tempFilename: string;
    backupFilename: string;
    queue: async.AsyncQueue<{}>;
    store: Store;
    constructor(filename: string = "./.store") {
        this.filename = filename;
        this.tempFilename = filename + '.temp';
        this.backupFilename = filename + '.bck';
        var self = this;
        this.queue = async.queue(function (task, cb) {
            self._persist(function (err) {
                if (err) {
                    throw err;
                }
                cb();
            });
        });

        this.store = self._load();
        self._resolvePath();
    }

    _fileMustNotExist(file: string, cb: ((err?: {} | Error | undefined) => void)) {
        fs.exists(file, function (exists) {
            if (!exists) {
                return cb();
            }

            fs.unlink(file, function (err) {
                return cb(err);
            });
        });
    }

    put(key: string, value: any) {
        if (typeof key !== 'string') {
            throw new Error('key must be a string');
        }

        this._setDeep(key.split('.'), value, false);
        this.queue.push({});
    };

    get(key: string): any {
        if (typeof key !== 'string') {
            throw new Error('key must be a string');
        }

        return this._getDeep(key.split('.'));
    };

    _getDeep(path: string[]) {
        var storage = this.store;

        for (var i = 0; i < path.length; i++) {
            var p = path[i];

            if (!isObject(storage)) {
                throw new Error(path.slice(0, i).join('.') + ' is not an object');
            }

            if (!storage.hasOwnProperty(p)) {
                return undefined;
            }

            storage = storage[p];
        }

        return storage;
    };

    _setDeep(path: string[], value: any, remove: boolean) {
        var storage = this.store;

        for (var i = 0; i < path.length; i++) {
            var p = path[i];

            if (!isObject(storage)) {
                throw new Error(path.slice(0, i).join('.') + ' is not an object');
            }

            if (i === path.length - 1) {
                setOrRemove(storage, p);
                return;
            }

            if (!storage.hasOwnProperty(p)) {
                storage[p] = {};
            }

            storage = storage[p];
        }

        function setOrRemove(obj: Store, key: string) {
            if (remove) {
                delete obj[key];
            } else {
                obj[key] = value;
            }
        }
    };

    remove(key: string) {
        if (typeof key !== 'string') {
            throw new Error('key must be a string');
        }

        this._setDeep(key.split('.'), undefined, true);
        this.queue.push({});
    };

    _persist(cb: async.AsyncResultArrayCallback<any, {}>) {
        var self = this;
        var _data = JSON.stringify(self.store);

        async.series([
            async.apply(self._fileMustNotExist, self.tempFilename),
            async.apply(self._fileMustNotExist, self.backupFilename),
            async.apply(self._doBackup.bind(self)),
            async.apply(self.writeData, self.tempFilename, _data),
            async.apply(fs.rename, self.tempFilename, self.filename),
            async.apply(self._fileMustNotExist, self.backupFilename)
        ], cb);
    }


    writeData(filename: string, data: string, cb: ((err?: {} | Error | undefined) => void)) {
        var _fd: number;

        async.waterfall([
            async.apply(fs.open, filename, 'w'),

            function (fd: number, cb: ((err?: Error | undefined) => void)) {
                _fd = fd;
                var buf = new Buffer(data);
                var offset = 0;
                var position = 0;

                fs.write(fd, buf, offset, buf.length, position, cb);
            },

            function (written: number, buf: Buffer, cb: ((err?: Error | undefined) => void)) {
                fs.fsync(_fd, cb);
            },

            function (cb: ((err?: Error | undefined) => void)) {
                fs.close(_fd, cb);
            }
        ], function (err) {
            cb(err);
        });
    };

    _doBackup(cb: (err?: NodeJS.ErrnoException | undefined) => void) {
        var self = this;

        fs.exists(self.filename, function (exists) {
            if (!exists) {
                return cb();
            }

            fs.rename(self.filename, self.backupFilename, cb);
        });
    };

    _load() {
        var data = {};

        try {
            data = JSON.parse(fs.readFileSync(this.filename, { encoding: 'utf8' }));
        } catch (e) {
            if (e.code !== 'ENOENT') {
                throw e;
            }
        }

        return data;
    };

    _resolvePath() {
        var _path = this.filename.split('/').slice(0, -1).join('/');

        if (_path) {
            mkdirp.sync(_path);
        }
    };
}