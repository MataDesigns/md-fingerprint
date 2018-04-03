import * as Util from 'util';
import { Logger, config, LoggerOptions, LoggerInstance, transports } from "winston";

export default class FingerPrintLogger {
    private log: LoggerInstance;
    constructor(options?: LoggerOptions) {
        this.log = new Logger(options || {
            level: 'debug',
            transports: [
                //
                // - Write to all logs with level `info` and below to `combined.log` 
                // - Write all logs error (and below) to `error.log`.
                //
                new transports.Console(),
                // new transports.File({ filename: 'error.log', level: 'error' }),
                new transports.File({ filename: 'combined.log' })
            ]
        });
        console.log();
    }

    _helper(message?: any, ...optionalParams: any[]) {
        var logMessage = Util.format(message);
        for (var param of optionalParams) {
            // console.log("PARAM!!!:", param);
            if (param.length != undefined) {
                if (param.length == 0) {
                    continue;
                }
                for (var p of param) {
                    // console.log("P!!!:", p);
                    logMessage += Util.format(p);
                }
            } else {
                logMessage += Util.format(param);
            }

        }
        // console.log("H:", logMessage);
        return logMessage;
    }

    error(message?: any, ...optionalParams: any[]) {
        this.log.error(this._helper(message, optionalParams));
    }
    warn(message?: any, ...optionalParams: any[]) {
        this.log.warn(this._helper(message, optionalParams));
    }
    data(message?: any, ...optionalParams: any[]) {
        this.log.data(this._helper(message, optionalParams))
    }
    info(message?: any, ...optionalParams: any[]) {
        this.log.info(this._helper(message, optionalParams));
    }
    debug(message?: any, ...optionalParams: any[]) {
        this.log.debug(this._helper(message, optionalParams));
    }
    prompt(message?: any, ...optionalParams: any[]) {
        this.log.prompt(this._helper(message, optionalParams));
    }
    verbose(message?: any, ...optionalParams: any[]) {
        this.log.verbose(this._helper(message, optionalParams));
    }
    input(message?: any, ...optionalParams: any[]) {
        this.log.input(Util.format(message, optionalParams.length > 0 ? optionalParams : null));
    }
    silly(message?: any, ...optionalParams: any[]) {
        this.log.silly(Util.format(message, optionalParams.length > 0 ? optionalParams : null));
    }
}