import * as vscode from 'vscode';

export class StatusBarMessageQueue
{
	private static instance: StatusBarMessageQueue | null = null;

	private queue:
		{
			message: string;
			timeout: number;
			priority: number;
		}[] = [];
	private isProcessing = false;
	private currentTimeoutId: NodeJS.Timeout | null = null;
	private currentMessageTimeoutRemaining: number = 0; // 表示中のメッセージの残り時間
    private currentMessageStartTime: number = 0; // 現在のメッセージが表示された時刻
	private currentResolve: (() => void) | null = null; // 動的 wait のための解決関数
	private currentMessage:{
		startTime: number,
		timeOut: number
	} | null = null;
	// Skip setting for identical messages
	private skipDuplicateMessages = true;
	private maxTimeout: number = 10000;
	private lowPriorityThreshold = 99;

	// Since this is a singleton implementation, the constructor should be private.
	private constructor() {}

	/**
	 * Returns Singleton instance
	 */
	public static getInstance(): StatusBarMessageQueue
	{
		if( ! this.instance )
		{
			this.instance = new StatusBarMessageQueue();
		}
		return this.instance;
	}

	/**
	 * Enque message
	 * @param {string} message - message
	 * @param {number} timeout - timeout(ms)
	 */
    public async enqueue(message: string, timeout: number, priority = 0): Promise<void>
	{
		if (this.skipDuplicateMessages && this.queue.some(q => q.message === message))
		{
			return;
		}

		console.debug(`enqueue: ${message} / ${timeout}` );

		this.queue.push({ message, timeout, priority });
		this.adjustTimeouts();
		this.queue.sort((a, b) => b.priority - a.priority);

		if (!this.isProcessing) {
			this.processQueue();
		}
		console.debug(`enqueue: ${this.queue.map( item => `${item.message} / ${item.timeout}` ).join("\n")}` )
	}

	/**
	 * Adjust so that the total timeout for priorities below or equal to lowPriorityThreshold
	 * does not exceed maxTimeout.
	 * However, ensure a minimum display time of 100 ms for each message.
	 */
	private adjustTimeouts(): void
	{
		let totalTimeout = this.getTotalTimeout();

		if (totalTimeout > this.maxTimeout) {
			const coef = this.maxTimeout / totalTimeout;

			// 表示中のメッセージの残り時間を短縮
			if( this.currentMessageTimeoutRemaining > 0 )
			{
				const elapsed = Date.now() - this.currentMessageStartTime;
				const remaining = Math.max(this.currentMessageTimeoutRemaining - elapsed, 0);
				const adjustedRemaining = Math.floor(remaining * coef);

				this.updateCurrentWait(adjustedRemaining);

				this.currentMessageTimeoutRemaining = adjustedRemaining;
                this.currentMessageStartTime = Date.now();
			}

			this.queue = this.queue.map((item) =>
			{
				if( item.priority > this.lowPriorityThreshold )
				{
					return item;
				}

				const adjustedTime = Math.floor( item.timeout * coef );
				const adjustedTimeout = Math.max( adjustedTime, 100); // 最低100msを保証
				return { ...item, timeout: adjustedTimeout };
			});
		}
	}

	/**
	 * Clear the queue and display the message immediately.
	 * @param {string} message - message
	 * @param {number} timeout - timeout(ms)
	 */
	public showNow(message: string, timeout: number): void {
		if (this.currentTimeoutId)
		{
			clearTimeout(this.currentTimeoutId);
			this.currentTimeoutId = null;
		}

		this.queue = [{ message, timeout, priority: Infinity }];
		
		this.processQueue();
	}


	/**
	 * Process queues sequentially
	 */
	private async processQueue(): Promise<void>
	{
		this.isProcessing = true;

		while (this.queue.length > 0)
		{
			const { message, timeout } = this.queue.shift()!;

			vscode.window.setStatusBarMessage(message , timeout);
			console.debug(`## setStatusBarMessage: ${message}`);

			this.currentMessageTimeoutRemaining = timeout;
            this.currentMessageStartTime = Date.now();

			console.debug(`--> wait(${timeout })`);
			await this.dynamicWait(timeout); // 動的に待機
			console.debug(`<-- wait end`);
		}

		this.isProcessing = false;
		this.currentTimeoutId = null;
	}

	private getTotalTimeout(): number
	{
		const elapsed = Date.now() - this.currentMessageStartTime;
		const remainingCurrent = Math.max(this.currentMessageTimeoutRemaining - elapsed, 0);

		return remainingCurrent + this.totalTimeOutInQueue();
	}

	private totalTimeOutInQueue()
	{
		const lowPriorityQueue = this.queue
			.filter((item) =>
			{
				return item.priority <= this.lowPriorityThreshold;
			});
		
		return lowPriorityQueue.reduce( (sum, item) => sum + item.timeout, 0);
	}

	/**
	 * 現在の待機を動的に更新
	 */
	private updateCurrentWait(newTimeout: number): void {
		if (this.currentTimeoutId){
			clearTimeout(this.currentTimeoutId); // 現在のタイムアウトをクリア
		}

		if (this.currentResolve) {
			this.currentTimeoutId = setTimeout(() => {
				this.currentResolve!(); // 新しいタイムアウトで解決
				this.currentResolve = null;
			}, newTimeout);
		}
	}

	/**
	 * 動的にキャンセル可能な待機
	 */
	private dynamicWait(timeout: number): Promise<void> {
		// 前回の解決関数が残っている場合は解決してクリーンアップ
		if (this.currentResolve) {
			console.warn("Previous dynamicWait resolve was not called, cleaning up.");
			this.currentResolve(); // 前回の待機を解決
			this.currentResolve = null;
		}

		return new Promise(resolve => {
			// 解決関数を保存
			this.currentResolve = resolve;

			// タイムアウト ID を保存
			const startTime = Date.now();
			this.currentTimeoutId = setTimeout(() => {
				console.log(`dynamicWait resolved after ${timeout}ms`);
				resolve(); // タイムアウトで解決
				this.currentResolve = null;
			}, timeout);

			// 動的調整関数を保存
			this.updateCurrentWait = (newTimeout: number) => {
				// 現在のタイムアウトをクリア
				if (this.currentTimeoutId) {
					clearTimeout(this.currentTimeoutId);
				}

				// 残り時間を計算
				const elapsed = Date.now() - startTime;
				const remaining = Math.max(timeout - elapsed, 0);

				// 新しいタイムアウトを設定
				const adjustedTimeout = Math.min(newTimeout, remaining);
				console.log(`Updating timeout to ${adjustedTimeout}ms`);

				this.currentTimeoutId = setTimeout(() => {
					console.log(`dynamicWait resolved after ${adjustedTimeout}ms`);
					resolve(); // 調整後のタイムアウトで解決
					this.currentResolve = null;
				}, adjustedTimeout);
			};
		});
	}

	/**
	 * The setter method for 'Skip setting for identical messages'.
	 * @param {boolean} skip - enable skip when true
	 */
	public setSkipDuplicateMessages(skip: boolean)
	{
		this.skipDuplicateMessages = skip;
	}

	public setMaxTimeout( ms: number )
	{
		if( ms < 100 ){ return false;}

		this.maxTimeout = ms;

		return true;
	}
}
