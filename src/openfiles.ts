import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import { window, commands, Disposable, Command, workspace } from 'vscode';

export class TreeItemFile extends vscode.TreeItem {

	constructor(
		public readonly document: vscode.TextDocument,
		public readonly unique: boolean
	) {
		super(document.uri, vscode.TreeItemCollapsibleState.None);
		this.id = document.uri.path
		this.label = path.basename(this.document.uri.path);
		this.dirname = path.dirname(this.document.uri.path);
		if (!unique) this.label += ` – ${path.basename(this.dirname)}`;
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
		})();
	}
}

export class TreeItemGroup extends vscode.TreeItem {
	constructor(
		public readonly label: string
	) {
		super(label, vscode.TreeItemCollapsibleState.Expanded);
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

	private textDocuments: vscode.TextDocument[] = [];

	private lastOnChange: number = 0;

	private treeView: vscode.TreeView<{}>;

	constructor(private context?: vscode.ExtensionContext) {
		let subscriptions: Disposable[] = [];

		workspace.onDidCloseTextDocument(this.onCloseTextDocument, this, subscriptions);
		window.onDidChangeActiveTextEditor(this.onChangeTextEditor, this, subscriptions);

		this.registerCommands();

		// Start cycle after 2 seconds because our onChange listener above doesn't instantly run
		this.cycleThroughEditorsAfterDelay(2000);

		this.treeView = vscode.window.createTreeView('openFiles', { treeDataProvider: this });
	}

	registerCommands(): void {
		this.context.subscriptions.push.apply(this.context.subscriptions, [

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
	}

	refresh(): void {
		this.cycleThroughEditors();
	}

	refreshTree(): void {
		this._onDidChangeTreeData.fire();
	}

	onCloseTextDocument(textDoc: vscode.TextDocument): void {
		let now = Math.floor(Date.now() / 1000);
		if ((now - this.lastOnChange) > 200) {
			return;
		}

		var before = this.textDocuments.length;
		this.textDocuments = this.textDocuments.filter((d) => d.uri !== textDoc.uri);

		if (before !== this.textDocuments.length) {
			this.refreshTree();
		}
	}

	onChangeTextEditor(textEditor: vscode.TextEditor): void {
		this.lastOnChange = Math.floor(Date.now() / 1000);

		let textDoc = textEditor.document;

		let exists = false;
		for (let d of this.textDocuments) {
			if (d.uri === textDoc.uri) {
				exists = true;
			}
		}

		if ( ! exists) {
			this.textDocuments.push(textEditor.document);
			this.refreshTree();
		}

		this.treeView.reveal(textEditor.document);
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

	async getChildren(item?: TreeItemFile | TreeItemGroup): Promise<(TreeItemFile | TreeItemGroup)[]> {
		if (item && item.contextValue === "file") {
			return [];
		}

		if (item instanceof TreeItemGroup) {
			return this.getChildrenFromGroup(<TreeItemGroup>item);
		}

		return this.getGroups();
	}

	async getGroups(): Promise<TreeItemGroup[]> {
		let result: TreeItemGroup[] = [];
		let alreadyGot = {};
		for (let document of this.textDocuments) {
			if (document.languageId in alreadyGot || 
				document.uri.scheme === "git" || document.uri.scheme === "vscode" || 
				document.isClosed) {
				continue; 
			}
			result.push(new TreeItemGroup(document.languageId));
			alreadyGot[document.languageId] = true;
		}

		result = result.sort((left, right) => {
			if ( ! left || ! right) {
				return 0;
			}
			return left.label.localeCompare(right.label);
		});

		return result;
	}

	async getChildrenFromGroup(group: TreeItemGroup): Promise<(TreeItemFile)[]> {
		let result: TreeItemFile[] = [];

		const documentsByName = {};
		for (const document of this.textDocuments) {
			const name = path.basename(document.uri.path);
			if (!documentsByName[name]) documentsByName[name] = []
			documentsByName[name].push(document)
		}

		for (const [name, documents] of (<any>Object).entries(documentsByName)) {
			for (const document of documents) {
				if (document.languageId !== group.label || document.isClosed) {
					continue;
				}
				let item = new TreeItemFile(document, documents.length === 1);
				group.items.push(item);
				result.push(item);
			}
		}

		result = result.sort((left, right) => {
			if ( ! left || ! right) {
				return 0;
			}
			return left.document.languageId.localeCompare(right.document.languageId) || 
				   left.label.localeCompare(right.label);
		});

		return result;
	}

	getTreeItem(element: TreeItemFile | TreeItemGroup | vscode.TextDocument): vscode.TreeItem {
		if (element instanceof vscode.TreeItem) {
			return <vscode.TreeItem>element;
		} else {
			return new TreeItemFile(<vscode.TextDocument>element, true);
		}
	}

	getParent(element: TreeItemFile | TreeItemGroup | vscode.TextDocument): TreeItemFile | TreeItemGroup {
		if (element instanceof TreeItemFile) {
			let item = <TreeItemFile>element;
			return new TreeItemGroup(item.document.languageId);
		}
		// For some reason I can't check instanceof vscode.TextDocument, so hack around it
		else if ( ! (element instanceof TreeItemGroup)) {
			let doc = <vscode.TextDocument>element;
			return new TreeItemGroup(doc.languageId);
		}
		return null;
	}
}
