import { Storage } from './store';

export class FingerPrintStore {
    store: Storage;
    storeArray: Array<boolean>;
    constructor() {
        this.store = new Storage('./.fingerprint-store');
        var arr = new Array<boolean>(30);
        arr.fill(false);
        this.storeArray = this.get('fparray', arr);
        this._save();

    }

    getAvailable() {
        for (var i in this.storeArray) {
            var value = this.storeArray[i];
            if (value == false) {
                return i;
            }
        }
        return null;
    }

    isAvailable(id: number) {
        return this.storeArray[id];
    }

    add(id: number) {
        this.storeArray[id] = true;
        this._save();
    }

    delete(id: number) {
        this.storeArray[id] = false;
        this._save();
    }

    set(key: string, value: any) {
        this.store.put(key, value);
    }

    get(key:string , defaultValue: any) {
        return this.store.get(key) || defaultValue;
    }

    _save() {
        this.store.put('fparray', this.storeArray);
    }

    _load() {
        this.storeArray = this.store.get('fparray');
    }

}