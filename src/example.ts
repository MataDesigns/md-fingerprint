import { FingerPrintReader, SupportedBaudRates } from "./";

let reader = new FingerPrintReader('/dev/ttyS0');

var onOpen = function () {
    console.log('After Open');
    reader.ledOn();
    // reader.changeBaudRate(115200).then(function() {
    //     reader.ledOff();
    // }).catch(function(err) {
    //     console.log(err);
    // })
}

var result = reader.open().then(onOpen);

// import { Queue, Task, Status } from '../src/queue';

// var queue = new Queue(function (task: Task) {
//     // console.log("   Processing:", task.id);
//     task.status = Status.Finished
//     console.log("   Finished:", task.id);
// });

// queue.emptied = function (lastTask) {
//     console.log("   Emptied!");
// }

// for(var i = 0; i < 7; i++) {
//     var task = new Task();
//     queue.enqueue(task);
//     console.log("Enqueued: ", task.id);
// }

// setTimeout(function() {
//     var task3 = new Task();
//     queue.enqueue(task3);
//     console.log("Enqueued: ", task3.id);
// }, 1000);

// setTimeout(function() {
//     var task4 = new Task();
//     queue.enqueue(task4);
//     console.log("Enqueued: ", task4.id);
// }, 500);

// queue.start();