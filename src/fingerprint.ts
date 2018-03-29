import SerialPort from "serialport";
import { FingerPrintStore } from "./fingerprintstore";
import { Queue } from "./queue";
import { SupportedBaudRates, CommandCode, PacketKind } from "./gt521xx-constants";
import { GT521Parser } from "./gt521fxx-parser";
import { DataPacket, ResponsePacket, CommandPacket } from "./gt521fxx-packets";

export class FingerPrintReader {
    /**
     * A Store/Storage that holds values such as array of ids that 
     * are currently being used to store fingerprints on the reader.
     */
    store: FingerPrintStore;
    /**
     * The system path of the serial port you want to open
     */
    path: string;
    /**
     * The queue of command packets that will be sent to the device.
     */
    commandQueue: Queue;
    /** 
     * The current baudrate (transfer speed in bytes) being used by SerialPort.
     */
    baudRate: number;
    /**
     * The desired buadrate (transfer speed in bytes). Default is 115200.
     */
    desiredBaudRate: number;
    /**
     * Whether the serial connection is currently opened.
     */
    isOpen: boolean = false;
    private serialPort: SerialPort;
    private parser: GT521Parser;
    private otherBaudRates: Array<number>;
    constructor(path: string, desiredBaudRate?: number) {
        this.store = new FingerPrintStore();
        this.path = path;
        this.commandQueue = new Queue();
        var baudRate = this.store.get('baudRate', 9600);
        this.baudRate = baudRate;
        this.desiredBaudRate = desiredBaudRate || 115200;

        this.otherBaudRates = SupportedBaudRates.filter(br => br !== baudRate);
        if(this.otherBaudRates.length == SupportedBaudRates.length) {
            throw new Error("Invalid BaudRate");
        }
        this.serialPort = new SerialPort(this.path, {
            baudRate: this.baudRate,
            autoOpen: false
        });
        this.parser = new GT521Parser();
        this.serialPort.pipe(this.parser);
        this.serialPort.on('open', this._onSerialPortOpen.bind(this));
        this.serialPort.on('close', this._onSerialPortClose.bind(this));
        this.parser.on('dataPacket', this._onDataPacket.bind(this));
        this.parser.on('responsePacket', this._onDataPacket.bind(this));
        this.parser.on('packet', this._onPacket.bind(this));
    }

    open(): Promise<{}> {
        var self = this;
        return this._openSerialPort();
    }

    /**
     * Changes the BaudRate on both the device and currently opened serialport.
     * @param newRate The new baudrate you wish to use.
     */
    changeBaudRate(newRate: number): Promise<{}> {
        var self = this;
        return new Promise(function (resolve, reject) {
            if(self.isOpen) return reject("Serial port is not open.");
            if(SupportedBaudRates.indexOf(newRate) == -1) return reject("Invalid BaudRate.");
            self._generateAndEnqueue(CommandCode.ChangeBraudRate, newRate).promise.then(function (cmd: CommandPacket) {
                self.serialPort.update({ baudRate: newRate }, function (err) {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(newRate);
                });
            }).catch(function (err) {
                return reject(err);
            });
        });
    }

    // Helpers
    /**
     * Generate a CommandPacket and add it to the end of the queue.
     * @param commandCode The command code that should be sent.
     * @param param The parameter for the comamand packet
     * @param responseKind The kind of response packet that should be expected.
     */
    private _generateAndEnqueue(commandCode: CommandCode, param: number, responseKind?: PacketKind) {
        var command = new CommandPacket(commandCode, param, responseKind || PacketKind.Response);
        this._enqueueSend(command);
        return command;
    }

    /**
     * Enqueue a CommandPacket
     * @param command The CommandPacket to add to the queue, or send if queue is empty.
     */
    private _enqueueSend(command: CommandPacket) {
        console.log("============================================");
        console.log("Enqueued:", command);
        this.commandQueue.enqueue(command);
        if (this.commandQueue.peek() && this.commandQueue.peek().id == command.id) {
            this._send(command);
            console.log('');
            console.log("Sent:", command);
        }
        console.log("============================================");
    }

    /**
     * Send a CommandPacket.
     * @param command The CommandPacket to send.
     */
    private _send(command: CommandPacket): Promise<{}> {
        var self = this;
        let buffer = command.buffer;
        return Promise.all([self._flush, self._write, self._drain])
    }

    /**
     * Open the SerialPort.
     */
    private _openSerialPort(): Promise<{}> {
        var self = this;
        return new Promise((resolve, reject) => {
            self.serialPort.open((err) => {
                err ? reject(err) : resolve();
            });
        });
    }

    // SerialPort Wrappers
    /**
     * Write data to the SerialPort. Wraps SerialPort.
     * Wraps function with a Promise.
     * @param data The data that will be written to the SerialPort.
     */
    private _write(data: string | number[] | Buffer): Promise<{}> {
        var self = this;
        return new Promise(function (resolve, reject) {
            self.serialPort.write(data, 'hex', function (err) {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }

    /**
     * Discards data received but not read, and written but not transmitted by the operating system.
     * Wraps SerialPort.flush function with a Promise.
     */
    private _flush(): Promise<{}> {
        var self = this;
        return new Promise(function (resolve, reject) {
            self.serialPort.flush(function (err) {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }

     /**
     * Waits until all output data is transmitted to the serial port.
     * Wraps SerialPort.drain function with a Promise.
     */
    private _drain(): Promise<{}> {
        var self = this;
        return new Promise(function (resolve, reject) {
            self.serialPort.drain(function (err) {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }

    // SerialPort Communication Events
    private _onSerialPortOpen() {
        console.log("Serial Connection Opened");
        this.isOpen = true;
        if(this.baudRate == this.desiredBaudRate) {

        }
    }

    private _onSerialPortClose() {
        console.log("Serail Connection Closed");
        this.isOpen = false;
    }

    // Parse Events
    private _onPacket(packet: (DataPacket | ResponsePacket)) {
        console.log("On Generic Packet", packet);
    }

    private _onDataPacket(packet: DataPacket) {
        console.log("On Data Packet", packet);
    }

    private _onResponsePacket(packet: ResponsePacket) {
        console.log("On Response Packet", packet);
    }
}
