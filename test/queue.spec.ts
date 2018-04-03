import { Queue, Task, Status } from '../src/queue';
import { expect, assert, should } from 'chai';
import 'mocha';

describe('Queue', () => {
    it('Enqueue', () => {
        var queue = new Queue(function(task: Task) {
            console.log(task.value);
            task.status = Status.Finished
        });

        var task = new Task(1);
        queue.enqueue(task);
        assert(queue.tasks.length == 1, "Task 1 not added.");
        task = new Task(2);
        queue.enqueue(task);
        assert(queue.tasks.length == 2, "Task 1 not added.");
        queue.start();
    });
});