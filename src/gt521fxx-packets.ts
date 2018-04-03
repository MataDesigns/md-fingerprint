import { ErrorCode, PacketKind, ResponseType, PacketCode, DeviceID, CommandCode } from "./gt521xx-constants";
import { Queue } from "./queue";
import * as Util from "util";

export class GT521Packet {
    buffer: Buffer;
    valid: boolean;
    kind!: PacketKind;
    constructor(buffer: Buffer) {
        this.buffer = buffer;
        this.valid = this.checkCRC();
    }

    checkCRC() {
        var sum = 0;
        for (var i = 0; i < this.buffer.length - 2; i++)
            sum += this.buffer[i];
        return ((sum & 0xFFFF) == this.buffer.readUInt16LE(this.buffer.length - 2));
    }

    checkSuccess() {

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
            return false;
        } else {
            if (ErrorCode[errorCode]) {
                return false;
            } else {
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
        return this.valid;
    }
}

export enum CommandPacketStatus {
    Created, Sent, Pending, Successful, Failure
}

export class CommandPacket extends GT521Packet {
    static globalCounter: number = 0;
    id: number;
    code: (CommandCode | number);
    param: number;
    responseType: PacketKind;
    responsePacket: (ResponsePacket | null);
    dataPacket: (DataPacket | null);
    queue: Queue;
    promise: Promise<any>;
    satisfied: boolean;
    timeout: number;
    private _timeout: NodeJS.Timer;
    private _resolver!: (value?: {} | PromiseLike<{}> | undefined) => void;
    private _rejecter!: (reason?: any) => void;

    constructor(code: (CommandCode | number), param: number, responseType: PacketKind, queue: Queue, timeoutAfter?: number) {
        var generateBuffer = function (): Buffer {
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
            return buffer;
        }
        super(generateBuffer());
        this.satisfied = false;
        this.timeout = timeoutAfter || 1500;
        this.queue = queue;
        this.id = CommandPacket.globalCounter;
        CommandPacket.globalCounter += 1;
        this.code = code;
        this.param = param;
        this.responseType = responseType;

        this.responsePacket = null;
        this.dataPacket = null;
        var self = this;
        this.promise = new Promise(function (resolve, reject) {
            self._resolver = resolve;
            self._rejecter = reject;
        });
        this._timeout = setTimeout(function () {
            self.reject(new Error("Packet timed out."));
        }, this.timeout);
    }

    resolve(value?: any) {
        this._satisfied(value, this._resolver);
    }
    reject(value?: any) {
        this._satisfied(value, this._rejecter);
    }

    private _satisfied(value?: any, fn?: (value?: any) => void) {
        if (!this.satisfied) {
            this.satisfied = true;
            if (fn) {
                fn(value);
            }
            clearTimeout(this.timeout);
            this._dequeue();
        }
    }

    private _dequeue() {
        if (this.queue.peek() && this.queue.peek().id == this.id) {
            this.queue.dequeue();
        }
    }

    addPacket(packet: GT521Packet): CommandPacketStatus {
        switch (packet.kind) {
            case PacketKind.Response:
                this.responsePacket = packet as ResponsePacket;
                var error = ErrorCode[this.responsePacket.param]
                if (error) {
                    this.reject(error);
                    return CommandPacketStatus.Failure;
                }
                break;
            case PacketKind.Data:
                this.dataPacket = packet as DataPacket;
                if (!this.dataPacket.valid) {
                    this.reject("Invalid checksum");
                    return CommandPacketStatus.Failure;
                }
                break;
        }
        if (this.responseType == packet.kind) {
            this.resolve(this);
            return CommandPacketStatus.Successful;
        } else {
            return CommandPacketStatus.Pending;
        }
    }

    dataObj(): (DeviceInfo | any) {
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

    printable(): string {
        var printable = {
            id: this.id,
            buffer: this.buffer,
            valid: this.valid,
            param: this.param,
            kind: this.kind,
            commandCode: this.code,
            responseType: this.responseType,
            timeout: this.timeout,
            responsePacket: this.responsePacket,
            dataPacket:this.dataPacket
        }

        return " Command Packet " + Util.format(printable);
    }
}

export interface DeviceInfo {
    firmwareVersion: string;
    isoAreaMaxSize: number;
    deviceSerialNumber: string;
}