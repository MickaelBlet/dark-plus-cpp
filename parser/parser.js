const vscode = require("vscode");
class Parser {

    constructor(contributions) {
        this.activeEditor;
        this.text;
        this.decoration;
        this.ranges = [];
        this.loadConfigurations(contributions);
    }

    //
    // PUBLIC
    //

    // load configuration from contributions
    loadConfigurations(contributions) {
        this.decoration = vscode.window.createTextEditorDecorationType(contributions.parameters);
    }

    resetDecorations(activeEditor) {
        if (!activeEditor) {
            return ;
        }
        // reset range
        this.ranges.length = 0;
        // disable old decoration
        activeEditor.setDecorations(this.decoration, this.ranges);
    }

    updateDecorations(activeEditor) {
        if (!activeEditor) {
            return ;
        }
        this.activeEditor = activeEditor;
        // replace by spaces
        this.text = this.replaceCommentsAndStrings(this.activeEditor.document.getText());
        // search all ranges
        this.searchFunctions();
        // set new decoration
        this.activeEditor.setDecorations(this.decoration, this.ranges);
        // reset range
        this.ranges.length = 0;
    }

    //
    // PRIVATE
    //

    // replace range by spaces
    replaceBySpace(str,start,end) {
        let size = end - start;
        return str.substr(0, start) + ' '.repeat(size) + str.substr(start + size);
    }

    // replace all expect by space
    replaceCommentsAndStrings(text) {
        // replacer common
        function replacer(str, offset, input) {
            return ' '.repeat(str.length);
        }
        // replace all \\
        text = text.replace(/\\\\(?<!$)/gm, replacer);
        // replace all containers
        text = text.replace(/"[^]*?(?:(?<!\\)")|'[^]*?(?:(?<!\\)')|\/\*[^]*?\*\/|\/\/[^]*?(?:(?<!\\)$)/gm, replacer);
        // replace define line
        text = text.replace(/#[^]*?(?:(?<!\\)$)/gm, replacer);
        return text;
    }

    // replace <[...]> by spaces
    containerHidden(text) {
        let level = 0;
        let start;
        let end;
        if (/[<]/gmi.test(text)) {
            for (let i = 0 ; i < text.length ; i++) {
                if (text[i] == "<") {
                    level++;
                    if (level == 1)
                        start = i;
                }
                else if (text[i] == ">") {
                    level--;
                    if (level == 0) {
                        end = i;
                        text = this.replaceBySpace(text,start,end+1);
                    }
                }
            }
        }
        if (/[{]/gmi.test(text)) {
            for (let i = 0 ; i < text.length ; i++) {
                if (text[i] == "{") {
                    level++;
                    if (level == 1)
                        start = i;
                }
                else if (text[i] == "}") {
                    level--;
                    if (level == 0) {
                        end = i;
                        text = this.replaceBySpace(text,start,end+1);
                    }
                }
            }
        }
        return text;
    }

    getOpenParenthesisIndex(index) {
        let i = this.text.indexOf("(", index);
        if (i < 0) {
            return null;
        }
        return i;
    }

    getCloseParenthesisIndex(index) {
        let isClose = false;
        let level = 0;
        for (let i = index ; i < this.text.length ; i++) {
            if (level == 1 && this.text[i] == ")") {
                isClose = true;
                level = 0;
            }
            else if (isClose === true && (this.text[i] == ":" || this.text[i] == "{" || this.text[i] == ";")) {
                return i;
            }
            else if (level > 0 && this.text[i] == ")") {
                level--;
            }
            else if (this.text[i] == "(") {
                isClose = false;
                level++;
            }
        }
        return null;
    }

    getOpenBraceIndex(index) {
        for (let i = index ; i < this.text.length ; i++) {
            if (this.text[i] == "(" || this.text[i] == ";") {
                return null;
            }
            if (this.text[i] == ":" || this.text[i] == "{") {
                return i;
            }
        }
        return null;
    }

    getCloseBraceIndex(index, isConstructor) {
        let level = 0 - isConstructor;
        for (let i = index ; i < this.text.length ; i++) {
            if (level == 0 && this.text[i] == "}") {
                return i;
            }
            else if (level > 0 && this.text[i] == "}") {
                level--;
            }
            else if (this.text[i] == "{") {
                level++;
            }
        }
        return null;
    }

    // search prototype in parenthesis (... [...], ... [...])
    searchPrototypes(start, end) {
        let words = [];

        let regEx = /([a-z_A-Z0-9<>]+\s*[&*]*\s*(?:[(][&*]*)?)\b([a-z_A-Z][a-z_A-Z0-9]*)\s*(?:,|=[^,]*(?:,|[)(])|[)(])\s*/gm;
        let text = this.text.substr(start, end - start);
        text = this.containerHidden(text);
        let search;
        while (search = regEx.exec(text)) {
            if (search[0].length == 0) {
                continue ;
            }
            words.push(search[2]);
            let startPos = this.activeEditor.document.positionAt(start + search.index + search[1].length);
            let endPos = this.activeEditor.document.positionAt(start + search.index + search[1].length + search[2].length);
            let range = { range: new vscode.Range(startPos, endPos) };
            this.ranges.push(range);
        }
        return words;
    }

    // search parameter after function
    searchParameters(words, start, end) {
        if (words.length == 0) {
            return ;
        }
        // generate regex for all parameters names
        let regexString = "(?<![.]|->|::)\\b(";
        regexString += words.join("|");
        regexString += ")\\b[^(]";
        let regEx = new RegExp(regexString, "gm");

        let text = this.text.substr(start, end - start);
        let search;
        while (search = regEx.exec(text)) {
            if (search[1].length == 0) {
                continue ;
            }
            let startPos = this.activeEditor.document.positionAt(start + search.index);
            let endPos = this.activeEditor.document.positionAt(start + search.index + search[1].length);
            let range = { range: new vscode.Range(startPos, endPos) };
            this.ranges.push(range);
        }
    }

    // search all function in text document
    searchFunctions() {
        let endParenthesis = 0;
        let startParenthesis;
        while (startParenthesis = this.getOpenParenthesisIndex(endParenthesis)) {
            endParenthesis = this.getCloseParenthesisIndex(startParenthesis);
            if (endParenthesis == null) {
                return ;
            }
            let startBrace = this.getOpenBraceIndex(endParenthesis);
            if (startBrace == null) {
                this.searchPrototypes(startParenthesis, endParenthesis)
            }
            else {
                let isConstructor = (this.text[startBrace] == ":");
                let endBrace = this.getCloseBraceIndex(++startBrace, isConstructor);
                if (endBrace == null) {
                    continue ;
                }
                let words = this.searchPrototypes(startParenthesis, endParenthesis)
                this.searchParameters(words, startBrace, endBrace);
                endParenthesis = endBrace;
            }
        }
    }

} // class Parser

exports.Parser = Parser;