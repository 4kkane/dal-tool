// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { generateGoFileFromSQL } from './gendalfile';
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "dal-tool" is now active!');

	let disposable = vscode.commands.registerCommand('dal-tool.GenDalFile', async () => {
        const sqlStatement = await vscode.window.showInputBox({
            placeHolder: 'Enter SQL statement to create MySQL table'
        });

        if (!sqlStatement) {
        	vscode.window.showWarningMessage('No SQL statement provided.');
        	return;
    	}
		
		// 转成 Go 文件
    	const goCode = generateGoFileFromSQL(sqlStatement);
		 
    	// filepath: [extension.ts](http://_vscodecontentref_/0)
		const match = sqlStatement.match(/CREATE\s+TABLE\s+([a-zA-Z0-9_]+)\.\s*`?([a-zA-Z0-9_]+)`?/i);
		// match[1] 是库名，match[2] 是表名
    	let fileName = 'output.go';
    	if (match) {
        	fileName = `${match[2]}.go`;
   		}

		const folders = vscode.workspace.workspaceFolders;
    	if (!folders) {
        	vscode.window.showWarningMessage('No workspace folder found.');
        	return;
    	}

    	const folderPath = folders[0].uri.fsPath;
    	const filePath = vscode.Uri.file(`${folderPath}/${fileName}`);

   	 	// 写入文件
    	await vscode.workspace.fs.writeFile(filePath, Buffer.from(goCode, 'utf8'));
    	const doc = await vscode.workspace.openTextDocument(filePath);
    	await vscode.window.showTextDocument(doc);
    	vscode.window.showInformationMessage(`Generated Go DAL code saved as ${fileName}.`);
    });


	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
