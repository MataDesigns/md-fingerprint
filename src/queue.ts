
export enum Status {
    Queued, Started, Finished
}
/**
 * A Task object used in a Queue.
 */
export class Task {
    private static globalId = 1;
    /**
     * A unique identifier for the queue.
     */
    id: number = -1;
    /**
     * A value/task object that will be used by the Queue processor function.
     */
    value: any;
    /**
     * The status of the task.
     */
    status: Status;
    constructor(value?: any) {
        this.id = Task.globalId;
        Task.globalId += 1;

        this.value = value
        this.status = Status.Queued
    }
}

/**
 * A Thread Queue that will execute tasks in a first in first out manner.
 */
export class Queue {
    private static globalId = 1;
    /**
     * The tasks currently in the queue.
     */
    tasks: Array<Task> = [];
    /**
     * Unique indentifier.
     */
    id: number = -1;
    /**
     * A function called in the main run loop.
     */
    processor: (value: any) => void;
    /**
     * A callback style function that will be excuted with the queue is empty.
     */
    emptied?: (lastTask: Task) => void;
    private _timeoutId: number = -1;

    constructor(processor: (task: Task) => void) {
        this.id = Queue.globalId;
        Queue.globalId += 1;
        this.processor = processor;
    }

    /**
     * Start the queue.
     */
    start() {
        if (this._timeoutId == -1) {
            this._timeoutId = setTimeout(this._main.bind(this), 100);
        }
    }

    /**
     * Kill the queue.
     */
    kill() {
        if (this._timeoutId != -1) {
            clearTimeout(this._timeoutId);
            this.tasks = [];
            this._timeoutId = -1;
        }
    }

    /**
     * Add/Enqueue a task to the queue.
     * @param value A task to be added to the queue.
     */
    enqueue(value: Task) {
        this.tasks.push(value);
    }

    /**
     * Remove First/Dequeue a task from the queue.
     * @returns {Task} The task removed/dequeued from the queue.
     */
    dequeue(): Task | undefined {
        return this.tasks.shift();
    }

    /**
     * Peek at the first Task in the queue.
     * @returns {Task} The task currently being processed by the queue.
     */
    peek(): Task {
        return this.tasks[0]
    }

    private _main() {
        var task = this.peek();
        if (task) {
            this.processor(task);
            if (task.status == Status.Finished) {
                this.dequeue();
                if (this.tasks.length == 0) {
                    if (this.emptied)
                        this.emptied(task);
                }
            }
        }

        this._timeoutId = setTimeout(this._main.bind(this), 100);
    }
}