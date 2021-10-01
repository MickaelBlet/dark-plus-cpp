const vscode = require("vscode");
const path = require("path");

class Parser {

    constructor(contributions) {
        this.activeEditor;
        this.text;
        this.decorationParameter;
        this.decorationUnusedParameter;
        this.logger = vscode.window.createOutputChannel("Highlight parameter C/C++");
        this.ranges = [];
        this.unusedRanges = [];
        this.loadConfigurations(contributions);
    }

    //
    // PUBLIC
    //

    // load configuration from contributions
    loadConfigurations(contributions) {
        this.decorationParameter = vscode.window.createTextEditorDecorationType(contributions.parameterCss);
        this.decorationUnusedParameter = vscode.window.createTextEditorDecorationType(contributions.unusedParameterCss);
    }

    log(text) {
        let date = new Date()
        this.logger.appendLine('[' +
            ("0" + date.getFullYear()).slice(-4) + '-' +
            ("0" + date.getDate()).slice(-2) + '-' +
            ("0" + (date.getMonth() + 1)).slice(-2) + ' ' +
            ("0" + date.getHours()).slice(-2) + ':' +
            ("0" + date.getMinutes()).slice(-2) + ':' +
            ("0" + date.getSeconds()).slice(-2) + '.' +
            ("0" + date.getMilliseconds()).slice(-3) + "] " +
            text);
    }

    resetDecorations(activeEditor) {
        if (!activeEditor) {
            return ;
        }
        if (activeEditor.document.languageId != "c" && activeEditor.document.languageId != "cpp") {
            return ;
        }
        // reset range
        this.ranges.length = 0;
        this.unusedRanges.length = 0;
        // disable old decoration
        activeEditor.setDecorations(this.decorationParameter, this.ranges);
        activeEditor.setDecorations(this.decorationUnusedParameter, this.unusedRanges);
    }

    updateDecorations(activeEditor) {
        if (!activeEditor) {
            return ;
        }
        if (activeEditor.document.languageId != "c" && activeEditor.document.languageId != "cpp") {
            return ;
        }
        let startTime = Date.now();
        this.activeEditor = activeEditor;
        // replace by spaces
        this.text = this.replaceCommentsAndStrings(this.activeEditor.document.getText());
        // search all ranges
        this.searchFunctions();
        // set new decoration
        activeEditor.setDecorations(this.decorationParameter, this.ranges);
        activeEditor.setDecorations(this.decorationUnusedParameter, this.unusedRanges);
        // log time
        this.log("Update decorations at \"" + path.basename(activeEditor.document.fileName) + "\" in " + (Date.now() - startTime) + "ms with " + (this.ranges.length + this.unusedRanges.length) + " occurence(s)")
        // reset range
        this.ranges.length = 0;
        this.unusedRanges.length = 0;
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
        // replace compiler macro
        text = text.replace(/\b(?:__[a-z_A-Z]+__|throw|noexcept|alignas|decltype)\b\s*[(][^);]*(?:[)\s]+)/gm, replacer);
        // replace enum
        text = text.replace(/\benum\b\s*(?:struct|class)?\s*(?:\b[a-z_A-Z0-9]+\b)?\s*(?:[:][^]*?(?:}\s*;)+|{[^]*?(?:}\s*;))/gm, replacer);

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
        // replace all define
        function replacer(str, offset, input) {
            return ' '.repeat(str.length);
        }
        text = text.replace(/(?!::)\s*\b[_A-Z]+\b\s*(?!::)/gm, replacer);
        return text;
    }

    getParenthesisIndex(index) {
        let startParenthesis = -1;
        for (let i = index ; i < this.text.length ; i++) {
            if ('(' === this.text[i]) {
                startParenthesis = i;
                break;
            }
        }
        if (startParenthesis < 0) {
            return null;
        }

        let level = 1;
        for (let i = startParenthesis + 1 ; i < this.text.length ; i++) {
            if (this.text[i] == ":" && this.text[i+1] == ":") {
                i++;
            }
            else if (level == 0 && (this.text[i] == ":" || this.text[i] == "{" || this.text[i] == ";")) {
                return [startParenthesis, i];
            }
            else if (level > 0 && this.text[i] == ")") {
                level--;
            }
            else if (level == 0 && this.text[i] == "(") {
                startParenthesis = i;
                level = 1;
            }
            else if (this.text[i] == "(") {
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

        let text = this.text.substr(start, end - start);
        text = this.containerHidden(text);
        let search;
        let regEx = /([a-z_A-Z0-9]+(?:::[&*]+)?\s*[&*]*\s*(?:[(][&*]*)?)\b([a-z_A-Z][a-z_A-Z0-9]*)\s*(?:,|=[^,]*(?:,|[)(])|\[[^\]]*\]|[)(])\s*/gm;
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
        let countFindWords = 0;
        // generate regex for all parameters names
        let regEx = new RegExp("((?<![.]\\s*|[-][>]\\s*|[:][:]\\s*))\\b(" +
                               words.join("|") +
                               ")\\b",
                               "gm");
        let text = this.text.substr(start, end - start);
        let search;
        while (search = regEx.exec(text)) {
            if (search[2].length == 0) {
                continue ;
            }
            let startPos = this.activeEditor.document.positionAt(start + search.index + search[1].length);
            let endPos = this.activeEditor.document.positionAt(start + search.index + search[1].length + search[2].length);
            let range = { range: new vscode.Range(startPos, endPos) };
            this.ranges.push(range);
            countFindWords++;
        }
        return countFindWords > 0;
    }

    // search all function in text document
    searchFunctions() {
        let endParenthesis = 0;
        let parenthesis;
        while (parenthesis = this.getParenthesisIndex(endParenthesis)) {
            let startParenthesis = parenthesis[0];
            endParenthesis = parenthesis[1];
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
