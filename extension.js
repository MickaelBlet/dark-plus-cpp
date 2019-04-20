const vscode = require("vscode");
const parser_1 = require("./parser/parser");

function activate(context) {
    let activeEditor;
    let activeEditors = new Map();
    let contributions = vscode.workspace.getConfiguration('mblet-syntax');

    let updateDecorations = function (useHash = false) {
        if (!activeEditor) {
            return ;
        }

        if (!activeEditors.has(activeEditor)) {
            return ;
        }

        activeEditors.get(activeEditor).FindFunctions();
    };

    if (vscode.window.visibleTextEditors.length > 0) {
        for (let i = 0 ; i < vscode.window.visibleTextEditors.length ; i++) {
            if (!activeEditors.has(vscode.window.visibleTextEditors[i])) {
                activeEditors.set(vscode.window.visibleTextEditors[i], new parser_1.Parser(vscode.window.visibleTextEditors[i], vscode.window.createTextEditorDecorationType(contributions.parameters)));
            }
        }
        let findFunction = function (value, key, map) {
            value.FindFunctions();
        }
        activeEditors.forEach(findFunction);
    }

    vscode.workspace.onDidChangeConfiguration(event => {
        contributions = vscode.workspace.getConfiguration('mblet-syntax');
        let reloadConfig = function (value, key, map) {
            value.Reset();
            value.init(vscode.window.createTextEditorDecorationType(contributions.parameters));
            value.FindFunctions();
        }
        activeEditors.forEach(reloadConfig);
    });

    if (vscode.window.activeTextEditor) {
        activeEditor = vscode.window.activeTextEditor;
    }

    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            if (!activeEditors.has(editor)) {
                activeEditors.set(editor, new parser_1.Parser(editor, vscode.window.createTextEditorDecorationType(contributions.parameters)));
            }
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    vscode.window.onDidChangeVisibleTextEditors(editors => {
        for (let i = 0 ; i < editors.length ; i++) {
            if (!activeEditors.has(editors[i])) {
                activeEditors.set(editors[i], new parser_1.Parser(editors[i], vscode.window.createTextEditorDecorationType(contributions.parameters)));
            }
        }
        let deleteOldText = function (value, key, map) {
            let isValid = false;
            for (let i = 0 ; i < editors.length ; i++) {
                if (editors[i] === key) {
                    isValid = true;
                    break;
                }
            }
            if (isValid === false) {
                activeEditors.delete(key);
            }
        }
        let findFunction = function (value, key, map) {
            value.FindFunctions();
        }
        activeEditors.forEach(deleteOldText);
        activeEditors.forEach(findFunction);
    });

    vscode.workspace.onDidCloseTextDocument(textDocument => {
        let deleteOldText = function (value, key, map) {
            if (key.document === textDocument)
                activeEditors.delete(key);
        }
        activeEditors.forEach(deleteOldText);
    });

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
        timeout = setTimeout(updateDecorations, contributions.setTimeout);
    }
}

function desactivate() {}

module.exports = {
	activate,
	desactivate
}