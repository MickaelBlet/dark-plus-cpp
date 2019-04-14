const vscode = require("vscode");
const parser_1 = require("./parser/parser");

function activate(context) {
    let activeEditor;
    let parser = new parser_1.Parser();

    // add command in list
    // let disposable = vscode.commands.registerCommand('extension.mbletParameters', () => {
    //     vscode.window.showInformationMessage('Hello World!');
    // });
    // context.subscriptions.push(disposable);

    let updateDecorations = function (useHash = false) {
        if (!activeEditor) {
            return ;
        }
        parser.FindFunctions(activeEditor);
    };

    // first launch
    if (vscode.window.activeTextEditor) {
        activeEditor = vscode.window.activeTextEditor;
        triggerUpdateDecorations();
    }

    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            parser.init();
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    var timeout;
    function triggerUpdateDecorations() {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(updateDecorations, 200);
    }
}

function desactivate() {}

module.exports = {
	activate,
	desactivate
}