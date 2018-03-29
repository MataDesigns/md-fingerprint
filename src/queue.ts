export class Queue {
    queue: Array<any>;
    constructor() {
        this.queue = []
    }

    enqueue(value: any) {
        this.queue.push(value)
    }

    dequeue() {
        return this.queue.shift();
    }

    peek(): any {
        return this.queue[0]
    }
}