import { Dictionary } from "async";

export var DeviceID = 0x0001;

export var SupportedBaudRates = [
    9600,
    19200,
    38400,
    57600,
    115200
];

export enum ErrorCode {
    Timeout = 0x1001,
    InvalidBaudrate = 0x1002,
    InvalidPosition = 0x1003,
    IsNotUsed = 0x1004,
    IsAlreadyUsed = 0x1005,
    CommunicationError = 0x1006,
    VerifyFailed = 0x1007,
    IdentifyFailed = 0x1008,
    DbIsFull = 0x1009,
    DbIsEmpty = 0x1010,
    TurnError = 0x100A,
    BadFinger = 0x100B,
    EnrollFailed = 0x100C,
    IsNotSupported = 0x100D,
    DeviceError = 0x100E,
    CaptureCanceled = 0x100F,
    InvalidParam = 0x1011,
    FingerIsNotPressed = 0x1012
}

export var PacketCode = {
    Command: {
        StartCode1: 0x55,
        StartCode2: 0xAA
    },
    Response: {
        StartCode1: 0x55,
        StartCode2: 0xAA
    },
    Data: {
        StartCode1: 0x5A,
        StartCode2: 0xA5
    }
};

export enum PacketKind {
    Command, Response, Data
}

export enum ResponseType {
    Ack = 0x30, Nack = 0x31
}

export enum CommandCode {
    Open = 0x01,
    Close = 0x02,
    USBInternalCheck = 0x03,
    ChangeBraudRate = 0x04,
    SetIAPMode = 0x05,
    CmosLed = 0x12,
    GetEnrollCount = 0x20,
    CheckEnrolled = 0x21,
    EnrollStart = 0x22,
    Enroll1 = 0x23,
    Enroll2 = 0x24,
    Enroll3 = 0x25,
    IsPressFinger = 0x26,
    DeleteId = 0x40,
    DeleteAll = 0x41,
    Verify = 0x50,
    Identify = 0x51,
    VerifyTemplate = 0x52,
    IdentifyTemplate = 0x53,
    CaptureFinger = 0x60,
    MakeTemplate = 0x61,
    GetImage = 0x62,
    GetRawImage = 0x63,
    GetTemplate = 0x70,
    SetTamplate = 0x71,
    GetDatabaseStart = 0x72,
    GetDatabaseEnd = 0x73,
    SetSecurityLevel = 0xF0,
    GetSecurityLevel = 0xF1,
    EnterStandbyMode = 0xF9
}