import {Transform} from "stream";
import {PacketCode} from "./gt521xx-constants"
import { ResponsePacket, DataPacket } from "./gt521fxx-packets";

export class GT521Parser extends Transform {
    buffer: Buffer;
    dataPacketLength: number;
    constructor() {
        var options = {
            objectMode: false
        }
        super(options)
        this.dataPacketLength = 0;
        this.buffer = Buffer.alloc(0);
    }

    _transform(chunk: any, encoding: string, callback: Function): void {
        var data = Buffer.concat([this.buffer, chunk]);
        if (data[0] == PacketCode.Response.StartCode1 && data[1] == PacketCode.Response.StartCode2 && data.length >= 12) {
            var responseBuffer = new Buffer(data.slice(0, 12));
            var responsePacket = new ResponsePacket(responseBuffer);
            this.emit("responsePacket", responsePacket);
            this.emit("packet", responsePacket);
            this.push(responseBuffer);
            data = data.slice(12);

        }
        var packetLength = this.dataPacketLength;
        if (data[0] == PacketCode.Data.StartCode1 && data[1] == PacketCode.Data.StartCode2 && data.length >= packetLength) {
            var dataBuffer = data.slice(0, packetLength);
            var dataPacket = new DataPacket(dataBuffer);
            this.emit("dataPacket", dataPacket);
            this.emit("packet", dataPacket);
            this.push(dataBuffer);
            data = data.slice(packetLength);
        }

        this.buffer = data;
        callback()
    }

    _flush(callback: Function) {
        console.log("HERE");
        this.push(this.buffer)
        this.buffer = Buffer.alloc(0)
        callback()
    }
}