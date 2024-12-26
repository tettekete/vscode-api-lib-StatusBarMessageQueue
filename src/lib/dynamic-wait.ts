
export class DynamicWait
{
	private currentTimeoutId: ReturnType<typeof setTimeout> | null = null;
	private resolveFunction: (() => void) | null = null;
	private startTime: number = 0;
	private timeoutDuration: number = 0;
	#timeoutCallback: (()=>void) | null = null;

	get timeout()
	{
		return this.timeoutDuration;
	}

	/**
	 * Main wait method
	 */
	public wait(timeout: number ,timeoutCallback?:()=>void): Promise<void>
	{
		// Resolve existing standby
		this.clear();

		this.#timeoutCallback	= timeoutCallback ?? null;

		return new Promise(resolve =>
		{
			this.resolveFunction = resolve;
			this.startTime = Date.now();
			this.timeoutDuration = timeout;

			this.currentTimeoutId = setTimeout(() =>
				{
					if( this.#timeoutCallback )
					{
						this.#timeoutCallback();
					}
					this.resolve();
					this.resetMembers();
				},
				timeout
			);
		});
	}

	/**
	 * A method to modify the timeout after a call to the wait method.
	 *
	 * If the elapsed time since the start of wait already exceeds the specified
	 * timeout, the wait will terminate immediately.
	 */
	public update(timeout: number): void
	{
		const elapsed		= Date.now() - this.startTime;
		const newTimeout	= Math.max( timeout - elapsed ,0 );

		// reset current timeout
		if (this.currentTimeoutId)
		{
			clearTimeout(this.currentTimeoutId);
		}

		// set new timeout to resolve.
		this.currentTimeoutId = setTimeout(() =>
		{
			if( this.#timeoutCallback )
			{
				this.#timeoutCallback();
			}

			this.resolve();
			this.resetMembers();
		}, newTimeout);

		this.startTime = Date.now();
		this.timeoutDuration = newTimeout;
	}

	/**
	 * A method to cancel waiting
	 */
	public cancel(): void
	{
		this.clear();
	}

	private resetMembers()
	{
		this.timeoutDuration	= 0;
		this.#timeoutCallback	= null;
	}

	/**
	 * Clear internal state
	 */
	private clear(): void
	{
		if (this.currentTimeoutId)
		{
			clearTimeout(this.currentTimeoutId);
			this.currentTimeoutId = null;
		}

		if (this.resolveFunction)
		{
			this.resolveFunction();
			this.resolveFunction = null;
		}

		this.resetMembers();
	}

	/**
	 * Execute the resolution process
	 */
	private resolve(): void {
		if (this.resolveFunction) {
			this.resolveFunction();
			this.resolveFunction = null;
		}

		this.clear();
	}
}