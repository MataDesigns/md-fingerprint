import { ErrorCode, PacketKind, ResponseType, PacketCode, DeviceID, CommandCode } from "./gt521xx-constants";

export class GT521Packet {
    buffer: Buffer;
    valid: boolean;
    kind!: PacketKind;
    promise: Promise<any>;
    protected _resolve!: (value?: {} | PromiseLike<{}> | undefined) => void;
    protected _reject!: (reason?: any) => void;
    constructor(buffer: Buffer) {
        this.buffer = buffer;
        this.valid = this.checkCRC();
        var self = this;
        this.promise = new Promise(function (resolve, reject) {
            self._resolve = resolve;
            self._reject = reject;
        });
    }

    promiseFn() {
        return this.promise;
    }

    checkCRC() {
        var sum = 0;
        for (var i = 0; i < this.buffer.length - 2; i++)
            sum += this.buffer[i];
        return ((sum & 0xFFFF) == this.buffer.readUInt16LE(this.buffer.length - 2));
    }
}

export class ResponsePacket extends GT521Packet {
    param: number;
    kind: PacketKind;
    response: number;
    constructor(buffer: Buffer) {
        super(buffer)
        this.param = buffer.readUInt16LE(4);
        this.kind = PacketKind.Response;
        this.response = buffer.readUInt16LE(8);
    }

    checkSuccess() {
        var errorCode = this.param;
        if (this.response == ResponseType.Nack) {
            this._reject(errorCode);
            return false;
        } else {
            if (ErrorCode[errorCode]) {
                this._reject(errorCode);
                return false;
            } else {
                this._resolve();
                return true;
            }
        }
    }
}

export class DataPacket extends GT521Packet {
    kind: PacketKind
    data: Buffer
    constructor(buffer: Buffer) {
        super(buffer);
        this.kind = PacketKind.Data;
        this.data = new Buffer(buffer.slice(4, buffer.length - 2));
    }

    checkSuccess() {
        this.valid ? this._resolve() : this._reject("Invalid Checksum");
        return this.valid;
    }
}

export class CommandPacket extends GT521Packet {
    static globalCounter : number = 0;
    id: number;
    code: (CommandCode | number);
    param: number;
    responseType: PacketKind;
    responsePacket: (ResponsePacket | null);
    dataPacket: (DataPacket | null);
    constructor(code: (CommandCode | number), param: number, responseType: PacketKind) {
        var buffer = new Buffer(12);

        buffer.writeUInt8(PacketCode.Command.StartCode1, 0);
        buffer.writeUInt8(PacketCode.Command.StartCode2, 1);
        buffer.writeUInt16LE(DeviceID, 2);
        buffer.writeUInt32LE(param | 0, 4);
        buffer.writeUInt8(code, 8);
        buffer.writeUInt8(0, 9);

        var checkSum = 0;
        for (var i = 0; i < 10; i++) {
            checkSum += buffer.readUInt8(i);
        }

        buffer.writeUInt16LE(checkSum, 10);

        super(buffer);
        this.id = CommandPacket.globalCounter;
        CommandPacket.globalCounter += 1;
        this.code = code;
        this.param = param;
        this.responseType = responseType;

        this.responsePacket = null;
        this.dataPacket = null;
    }

    addPacket(packet: GT521Packet) {
        var self = this;
        packet.promise.then(function () {
            switch (packet.kind) {
                case PacketKind.Response:
                    self.responsePacket = packet as ResponsePacket;
                    var error  = ErrorCode[self.responsePacket.param]
                    if(error) {
                        self._reject(error);
                    }
                    break;
                case PacketKind.Data:
                    self.dataPacket = packet as DataPacket;
                    break;
            }
        }, function (err) {
            self._reject(err);
        });
    }

    dataObj(): any {
        if (!this.dataPacket) {
            return null;
        }
        let data = this.dataPacket.data;
        switch (this.code) {
            case CommandCode.Open:
                return {
                    firmwareVersion: data.readUInt32LE(0).toString(16),
                    isoAreaMaxSize: data.readUInt32LE(4),
                    deviceSerialNumber: data.slice(8).toString('hex')
                }
            case CommandCode.CmosLed:
                break;
        }
    }
}