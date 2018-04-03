import SerialPort from "serialport";
import { FingerPrintStore } from "./fingerprintstore";
import { Queue, Task, Status } from "./queue";
import { SupportedBaudRates, CommandCode, PacketKind } from "./gt521xx-constants";
import { GT521Parser } from "./gt521fxx-parser";
import { DataPacket, ResponsePacket, CommandPacket, DeviceInfo, CommandPacketStatus } from "./gt521fxx-packets";
import FingerPrintLogger from "./fingerprintlogger";
import { LoggerOptions } from "winston";
import { execSync } from 'child_process';
import { queue } from "async";

var seperator = "================================================";

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
    deviceInfo?: DeviceInfo;
    log: FingerPrintLogger;
    private serialPort: SerialPort;
    private parser: GT521Parser;
    private otherBaudRates: Array<number>;
    constructor(path: string, desiredBaudRate?: number, loggerOptions?: LoggerOptions) {
        this.log = new FingerPrintLogger(loggerOptions);
        this.store = new FingerPrintStore();
        this.path = path;
        this.commandQueue = new Queue(this._taskProcessor.bind(this));
        var baudRate = this.store.get('baudRate', 9600);
        this.log.info("BaudRate: ", baudRate);
        this.baudRate = 115200;
        this.desiredBaudRate = desiredBaudRate || 115200;

        this.otherBaudRates = SupportedBaudRates.filter(br => br !== baudRate);
        if (this.otherBaudRates.length == SupportedBaudRates.length) {
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
        this.parser.on('responsePacket', this._onResponsePacket.bind(this));
        this.parser.on('packet', this._onPacket.bind(this));
    }

    async open(): Promise<(CommandPacket | void)> {
        var self = this;
        await this._openSerialPort();
        let cmd = await self._openWithInfo().promise;
        if (cmd != null) {
            self.deviceInfo = cmd.dataObj() as DeviceInfo
            self.log.debug(seperator);
            self.log.info("Device Info", self.deviceInfo);
            self.log.debug(seperator);
        }

        return cmd;
    }

    /**
     * Changes the BaudRate on both the device and currently opened serialport.
     * @param newRate The new baudrate you wish to use.
     */
    changeBaudRate(newRate: number): Promise<{}> {
        var self = this;
        return new Promise(function (resolve, reject) {
            if (!self.isOpen) return reject("Serial port is not open.");
            if (SupportedBaudRates.indexOf(newRate) == -1) return reject("Invalid BaudRate.");
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

    ledOn(): Promise<void | CommandPacket> {
        return this._setLed(true).promise;
    }

    ledOff(): Promise<void | CommandPacket> {
        return this._setLed(false).promise;
    }

    // Helpers
    //      Open
    private _openWithInfo(): CommandPacket {
        return this._open(true)
    }
    private _openWithoutInfo(): CommandPacket {
        return this._open(false)
    }
    private _open(withInfo: boolean): CommandPacket {
        if (withInfo) {
            this.parser.dataPacketLength = 30;
        }
        return this._generateAndEnqueue(CommandCode.Open, withInfo ? 1 : 0, withInfo ? PacketKind.Data : PacketKind.Response);
    }
    //      Led
    private _setLed(state: boolean): CommandPacket {
        return this._generateAndEnqueue(CommandCode.CmosLed, state ? 1 : 0);
    }
    /**
     * Generate a CommandPacket and add it to the end of the queue.
     * @param commandCode The command code that should be sent.
     * @param param The parameter for the comamand packet
     * @param responseKind The kind of response packet that should be expected.
     */
    private _generateAndEnqueue(commandCode: CommandCode, param: number, responseKind?: PacketKind): CommandPacket {
        var command = new CommandPacket(commandCode, param, responseKind || PacketKind.Response, this.commandQueue);
        // this._enqueueSend(command);
        var task = new Task(command);
        this.commandQueue.enqueue(task);
        return command;
    }

    // SerialPort Wrappers
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

    /**
     * Send a CommandPacket.
     * @param command The CommandPacket to send.
     */
    private _send(command: CommandPacket): Promise<void | {}> {
        var self = this;
        let buffer = command.buffer;
        // this.log.silly("Sending: ", buffer);
        return self._flush().then(function () {
            return self._write(buffer)
        }).catch(function (err) {
            // self.log.error(err);
        })
    }

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
                    self.log.error("Failed to Write Serial:", err);
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
                    self.log.error("Failed to Flush Serial:", err);
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
                    self.log.error("Failed to Drain Serial:", err);
                    return reject(err);
                }
                return resolve();
            });
        });
    }

    // SerialPort Communication Events
    private _onSerialPortOpen() {
        this.log.info("Serial Connection Opened");
        this.isOpen = true;
    }

    private _onSerialPortClose() {
        this.log.info("Serial Connection Closed");
        this.isOpen = false;
    }

    // Queue Processor
    private _taskProcessor(task: Task) {
        var cmd = task.value as CommandPacket;
        switch (task.status) {
            case Status.Queued:
                this._send(cmd);
                task.status = Status.Started;
                break;
            case Status.Finished:
                if (cmd.satisfied) {
                    task.status = Status.Finished;
                }
                break;
        }
    }

    // Parse Events
    private _onPacket(packet: (DataPacket | ResponsePacket)) {
        var cmd = this.commandQueue.peek().value as CommandPacket;
        var result = cmd.addPacket(packet);

        switch (result) {
            case CommandPacketStatus.Successful:
                this.log.debug(seperator);
                this.log.debug("SUCCCESSFUL: ", cmd.id);
                this.log.debug(seperator);
                break;
            case CommandPacketStatus.Failure:
                this.log.debug("FAILURE: ", cmd.id);
                this.log.debug(seperator);
                break;
        }
        // if (result != CommandPacketStatus.Pending) {
        //     var nextCmd = this.commandQueue.peek();
        //     if (nextCmd) {
        //         this.log.debug("Sending Command: ", cmd.id);
        //         this._send(nextCmd);
        //         this.log.debug(seperator);
        //     }
        // }
    }

    private _onDataPacket(packet: DataPacket) {
        this.log.debug('');
        this.log.debug("On Data Packet", packet);
        this.log.debug(seperator);
    }

    private _onResponsePacket(packet: ResponsePacket) {
        this.log.debug(seperator);
        this.log.debug("On Response Packet", packet);
    }
}
