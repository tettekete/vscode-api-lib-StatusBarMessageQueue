import * as vscode from 'vscode';

import { DynamicWait } from './dynamic-wait';

type MessageQueueItem =
{
	message: string;
	timeout: number;
	priority: number;
	initialTimeout: number;
};
export class StatusBarMessageQueue
{
	static #instance: StatusBarMessageQueue | null = null;

	#queue: MessageQueueItem[] = [];
	#activeMessage:MessageQueueItem | null = null;

	#isProcessing = false;
	#dynamicWait = new DynamicWait();

	// Skip setting for identical messages
	#skipDuplicateMessages = true;
	#maxTimeout: number = 10000;
	#lowPriorityThreshold = 99;

	// Since this is a singleton implementation, the constructor should be private.
	private constructor() {}

	/**
	 * Returns Singleton instance
	 */
	public static getInstance(): StatusBarMessageQueue
	{
		if( ! this.#instance )
		{
			this.#instance = new StatusBarMessageQueue();
		}
		return this.#instance;
	}

	/**
	 * Enque message
	 * @param {string} message - message
	 * @param {number} timeout - timeout(ms)
	 */
    public async enqueue(message: string, timeout: number, priority = 0): Promise<void>
	{
		if (this.#skipDuplicateMessages && this.#queue.some(q => q.message === message))
		{
			return;
		}

		console.debug(`enqueue: ${message} / ${timeout}` );

		const initialTimeout = timeout;
		this.#queue.push({ message, timeout, priority ,initialTimeout});
		this.adjustTimeouts();
		this.#queue.sort((a, b) => b.priority - a.priority);

		if ( ! this.#isProcessing)
		{
			this.processQueue();
		}
		console.debug(`adjusted: ${this.#queue.map( item => `${item.message} / ${item.timeout}` ).join("\n")}` );
	}


	/**
	 * Clear the queue and display the message immediately.
	 * @param {string} message - message
	 * @param {number} timeout - timeout(ms)
	 */
	public showNow(message: string, timeout: number): void {
		this.#dynamicWait.cancel();

		const initialTimeout = timeout;
		this.#queue = [{ message, timeout, priority: Infinity ,initialTimeout}];
		
		this.processQueue();
	}


	/**
	 * Process queues sequentially
	 */
	private async processQueue(): Promise<void>
	{
		this.#isProcessing = true;

		while (this.#queue.length > 0)
		{
			const queueItem = this.#queue.shift()!;

			this.#activeMessage = queueItem;

			vscode.window.setStatusBarMessage(queueItem.message , queueItem.initialTimeout);

			await this.#dynamicWait.wait( queueItem.timeout );
		}

		this.#activeMessage = null;
		this.#isProcessing = false;
	}

	/**
	 * Adjust so that the total timeout for priorities below or equal to lowPriorityThreshold
	 * does not exceed maxTimeout.
	 * However, ensure a minimum display time of 100 ms for each message.
	 */
	private adjustTimeouts(): void
	{
		let totalTimeout = this.getTotalTimeout();

		if (totalTimeout > this.#maxTimeout)
		{
			const coef = this.#maxTimeout / totalTimeout;

			// 表示中のメッセージの残り時間を短縮
			if( this.#activeMessage )
			{
				const newTimeout = Math.floor( this.#activeMessage.initialTimeout * coef );

				this.#dynamicWait.update( newTimeout );
			}

			this.#queue = this.#queue.map((item) =>
			{
				if( item.priority > this.#lowPriorityThreshold )
				{
					return item;
				}

				let adjustedTimeout	= Math.floor( item.initialTimeout * coef );
				adjustedTimeout		= Math.max( adjustedTimeout, 100); // 最低100msを保証
				return { ...item, timeout: adjustedTimeout };
			});
		}
	}

	private getTotalTimeout(): number
	{
		if( this.#activeMessage )
		{
			return this.#activeMessage?.initialTimeout + this.totalTimeOutInQueue();
		}

		return this.totalTimeOutInQueue();
		
	}

	private totalTimeOutInQueue()
	{
		const lowPriorityQueue = this.#queue
			.filter((item) =>
			{
				return item.priority <= this.#lowPriorityThreshold;
			});
		
		return lowPriorityQueue.reduce( (sum, item) => sum + item.initialTimeout, 0);
	}


	/**
	 * The setter method for 'Skip setting for identical messages'.
	 * @param {boolean} skip - enable skip when true
	 */
	public setSkipDuplicateMessages(skip: boolean)
	{
		this.#skipDuplicateMessages = skip;
	}

	public setMaxTimeout( ms: number )
	{
		if( ms < 100 ){ return false;}

		this.#maxTimeout = ms;

		return true;
	}
}
