import * as vscode from 'vscode';
import { StatusBarMessageQueue } from './lib/status-bar-message-queue';

function StatusBarMessageQueueTest01()
{
	const messageQueue = StatusBarMessageQueue.getInstance();

	messageQueue.setMaxTimeout( 5000 );
	
	const mesages:[string,number][] = [
		[
			"first message timeout = 4 sec" ,4000
		],
		[
			"second message timeout = 2 sec" ,2000
		],
		[
			"3rd message timeout = 2 sec" ,2000
		],
		[
			"4th message timeout = 2 sec" ,2000
		],
		[
			"5th message timeout = 2 sec" ,2000
		]
	];

	for( const item of mesages )
	{
		messageQueue.enqueue(...item);
	}
}

export function activate(context: vscode.ExtensionContext) {

	const test01 = vscode.commands.registerCommand('status-bar-message-queue.test01',StatusBarMessageQueueTest01);

	context.subscriptions.push(test01);
}

// This method is called when your extension is deactivated
export function deactivate() {}
