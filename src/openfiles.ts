import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as rimraf from 'rimraf';
import { window, commands, Disposable, Command, workspace } from 'vscode';

var openFiles: OpenFiles;

class TreeItemFile extends vscode.TreeItem {

	constructor(
		public readonly document: vscode.TextDocument
	) {
		super(document.uri, vscode.TreeItemCollapsibleState.None);
		this.label = path.basename(this.document.uri.toString());
		this.dirname = path.dirname(this.document.uri.toString());
		console.log(document);
	}

	contextValue: string = 'file';
	label: string = '';
	dirname: string = '';
	ext: string = '';
	
	get command(): Command {
		return {
			command: 'extension.openfiles.SelectItem',
			title: '',
			arguments: [this.document]
		};
	}

	close(): void {
		(async () => {
			await vscode.window.showTextDocument(this.document);
			commands.executeCommand('workbench.action.closeActiveEditor');
			openFiles.refresh();
		})();
	}
}

class TreeItemGroup extends vscode.TreeItem {
	constructor(
		public readonly label: string
	) {
		super(label, vscode.TreeItemCollapsibleState.None);
	}

	items: TreeItemFile[] = [];
	contextValue: string = 'group';

	close(): void {
		for (let item of this.items) {
			item.close();
		}
	}
}

export class OpenFiles implements vscode.TreeDataProvider<TreeItemFile|TreeItemGroup> {

	private _onDidChangeTreeData: vscode.EventEmitter<TreeItemFile | TreeItemGroup | undefined> = new vscode.EventEmitter<TreeItemFile | TreeItemGroup | undefined>();
	readonly onDidChangeTreeData: vscode.Event<TreeItemFile | TreeItemGroup | undefined> = this._onDidChangeTreeData.event;

	private treeView: vscode.TreeView<{}>;

	constructor(context: vscode.ExtensionContext) {
		openFiles = this;

		let subscriptions: Disposable[] = [];
		window.onDidChangeActiveTextEditor(this.onChangeEditor, this, subscriptions);

		// Register commands
		context.subscriptions.push.apply(context.subscriptions, [

			commands.registerCommand('extension.openfiles.SelectItem', (document: vscode.TextDocument) => {
				window.showTextDocument(document);
			}),

			commands.registerCommand('extension.openfiles.refresh', () => {
				this.refresh();
			}),

			commands.registerCommand('extension.openfiles.closeAll', () => {
				commands.executeCommand('workbench.action.closeAllEditors');
			}),

			commands.registerCommand('extension.openfiles.close', (item: TreeItemFile) => {
				item.close();
			}),

			commands.registerCommand('extension.openfiles.closeGroup', (item: TreeItemGroup) => {
				(async () => {
					item.close();
				})();
			})
		]);

		// Start cycle after 2 seconds because our onChange listener above doesn't instantly run
		this.cycleThroughEditorsAfterDelay(2000);

		this.treeView = vscode.window.createTreeView('openFiles', { treeDataProvider: this });
	}

	refresh(): void {
		this.cycleThroughEditors();
	}

	refreshTree(): void {
		this._onDidChangeTreeData.fire();
	}

	onChangeEditor(editor?: vscode.TextEditor): void {
		this.refreshTree();
	}

	async cycleThroughEditorsAfterDelay(msec: number): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 2000));
		this.cycleThroughEditors();
	}

	async cycleThroughEditors(): Promise<void> {
		let seen = {};
		let active = window.activeTextEditor;
		while ( ! (active.document.uri.toString() in seen)) {
			await commands.executeCommand('workbench.action.nextEditor');
			await new Promise(resolve => setTimeout(resolve, 500));
			seen[active.document.uri.toString()] = true;
			active = window.activeTextEditor;
		}
	}

	// tree data provider

	async getChildren(element?: TreeItemFile | TreeItemGroup): Promise<(TreeItemFile | TreeItemGroup)[]> {
		if (element) {
			return [];
		}

		let result: (TreeItemFile | TreeItemGroup)[] = [];
		for (let document of workspace.textDocuments) {
			if (document.uri.scheme === "git" || document.uri.scheme === "vscode") {
				continue; 
			}
			result.push(new TreeItemFile(document));
		}

		result = result.sort((left: TreeItemFile, right: TreeItemFile) => {
			if ( ! left || ! right) {
				return 0;
			}
			return left.document.languageId.localeCompare(right.document.languageId) || 
				   left.label.localeCompare(right.label);
		});

		let groupItem: TreeItemGroup;
		let lastGroup = "";
		for (let x=0; x < result.length; x++) {
			let item = <TreeItemFile>result[x];
			let group = item.document.languageId;

			if (group !== lastGroup) {
				groupItem = new TreeItemGroup(group.toUpperCase());
				result.splice(x, 0, groupItem);
				lastGroup = group;
			}

			groupItem.items.push(item);
		}

		return result;
	}

	getTreeItem(element: TreeItemFile | TreeItemGroup): vscode.TreeItem {
		return element;
	}
}
