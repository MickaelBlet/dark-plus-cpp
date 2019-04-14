const vscode = require("vscode");
class Parser
{
    constructor()
    {
        this.activeEditor;
        this.text;
        this.options;
        this.decoration;
        this.ranges = [];
        this.rangeParenthesis;
        this.rangeBraces;
        this.init();
    }

    init()
    {
        this.contributions = vscode.workspace.getConfiguration('mblet-syntax');
        this.options = this.contributions.parameters;
        this.decoration = vscode.window.createTextEditorDecorationType(this.options);
    }

    setRange(str,start,end)
    {
        let size = end - start;
        return str.substr(0, start) + ' '.repeat(size) + str.substr(start + size);
    }

    replaceCommentsAndStrings(text)
    {
        let start = 0;
        let end = 0;

        // remove '\\'
        for (let i = 1 ; i < text.length ; i++)
        {
            if (text[i] == "\\" && text[i - 1] == "\\")
            {
                text = this.setRange(text, i - 1, i + 1);
            }
        }
        let inChar = false;
        let inString = false;
        let inCommentLine = false;
        let inCommentBlock = false;
        let inDefine = false;
        for (let i = 1 ; i < text.length ; i++)
        {
            if (inChar)
            {
                if (text[i] == "\'" && text[i - 1] != "\\")
                {
                    inChar = false;
                    end = i;
                    text = this.setRange(text,start,end);
                }
            }
            else if (inString)
            {
                if (text[i] == "\"" && text[i - 1] != "\\")
                {
                    inString = false;
                    end = i;
                    text = this.setRange(text,start,end);
                }
            }
            else if (inCommentLine)
            {
                if (text[i] == "\n" && text[i - 1] != "\\")
                {
                    inCommentLine = false;
                    end = i;
                    text = this.setRange(text,start,end);
                }
            }
            else if (inCommentBlock)
            {
                if (text[i] == "/" && text[i - 1] == "*")
                {
                    inCommentBlock = false;
                    end = i;
                    text = this.setRange(text,start,end);
                }
            }
            else if (inDefine)
            {
                if (text[i] == "\n" && text[i - 1] != "\\")
                {
                    inDefine = false;
                    end = i;
                    text = this.setRange(text,start,end);
                }
            }
            else if (text[i] == "\"" && !inString && text[i - 1] != "\\")
            {
                inString = true;
                start = i;
            }
            else if (text[i] == "/" && text[i - 1] == "/")
            {
                inCommentLine = true;
                start = i;
            }
            else if (text[i] == "*" && text[i - 1] == "/")
            {
                inCommentBlock = true;
                start = i;
            }
            else if (text[i] == "\'" && text[i - 1] != "\\")
            {
                inChar = true;
                start = i;
            }
            else if (text[i] == "#" && text[i - 1] != "\\")
            {
                inDefine = true;
                start = i;
            }
        }
        return text;
    }

    containerHidden(text)
    {
        let level = 0;
        let start;
        let end;
        for (let i = 0 ; i < text.length ; i++)
        {
            if (text[i] == "<")
            {
                level++;
                if (level == 1)
                    start = i;
            }
            else if (text[i] == ">")
            {
                level--;
                if (level == 0)
                {
                    end = i;
                    text = this.setRange(text,start,end);
                }
            }
        }
        return text;
    }

    getOpenParenthesisIndex(index)
    {
        for (let i = index ; i < this.text.length ; i++)
        {
            if (this.text[i] == "(")
            {
                return i;
            }
        }
        return null;
    }

    getCloseParenthesisIndex(index)
    {
        let level = 0;
        for (let i = index ; i < this.text.length ; i++)
        {
            if (level == 0 && this.text[i] == ")")
            {
                return i;
            }
            else if (level > 0 && this.text[i] == ")")
            {
                level--;
            }
            else if (this.text[i] == "(")
            {
                level++;
            }
        }
        return null;
    }

    getOpenBraceIndex(index)
    {
        for (let i = index ; i < this.text.length ; i++)
        {
            if (this.text[i] == "(")
            {
                return null;
            }
            if (this.text[i] == ";")
            {
                return null;
            }
            if (this.text[i] == ":")
            {
                return i;
            }
            if (this.text[i] == "{")
            {
                return i;
            }
        }
        return null;
    }

    getCloseBraceIndex(index, isConstructor)
    {
        let level = 0 - isConstructor;
        for (let i = index ; i < this.text.length ; i++)
        {
            if (level == 0 && this.text[i] == "}")
            {
                return i;
            }
            else if (level > 0 && this.text[i] == "}")
            {
                level--;
            }
            else if (this.text[i] == "{")
            {
                level++;
            }
        }
        return null;
    }

    hightlightPrototype(start, end)
    {
        let words = [];

        let regexString = "([a-z_A-Z0-9<>]+\\s*[&*]*\\s*)\\b([a-z_A-Z][a-z_A-Z0-9]*)\\s*(?:,|=[^,]*(?:,|$)|$)\\s*";
        let regEx = new RegExp(regexString, "gm");

        let text = this.text.substr(start, end - start);
        text = this.containerHidden(text);
        let search;
        while (search = regEx.exec(text))
        {
            words.push(search[2]);
            let startPos = this.activeEditor.document.positionAt(start + search.index + search[1].length);
            let endPos = this.activeEditor.document.positionAt(start + search.index + search[1].length + search[2].length);
            let range = { range: new vscode.Range(startPos, endPos) };
            this.ranges.push(range);
        }
        return words;
    }

    hightlightParameter(words, start, end)
    {
        let regexString = "\\b(";
        regexString += words.join("|");
        regexString += ")\\b[^(]";
        let regEx = new RegExp(regexString, "gm");

        let text = this.text.substr(start, end - start);
        let search;
        while (search = regEx.exec(text))
        {
            let startPos = this.activeEditor.document.positionAt(start + search.index);
            let endPos = this.activeEditor.document.positionAt(start + search.index + search[1].length);
            let range = { range: new vscode.Range(startPos, endPos) };
            this.ranges.push(range);
        }
    }

    hightlightFunctions()
    {
        let endParenthesis = 0;
        let startParenthesis;
        while (startParenthesis = this.getOpenParenthesisIndex(endParenthesis))
        {
            endParenthesis = this.getCloseParenthesisIndex(++startParenthesis);
            if (endParenthesis == null)
                return ;
            let startBrace = this.getOpenBraceIndex(endParenthesis);
            if (startBrace == null)
            {
                this.hightlightPrototype(startParenthesis, endParenthesis)
            }
            else
            {
                let isConstructor = (this.text[startBrace] == ":");
                let endBrace = this.getCloseBraceIndex(++startBrace, isConstructor);
                if (endBrace == null)
                {
                    continue ;
                }
                let words = this.hightlightPrototype(startParenthesis, endParenthesis)
                this.hightlightParameter(words, startBrace, endBrace);
                endParenthesis = endBrace;
            }
        }
    }

    FindFunctions(activeEditor)
    {
        // reset last range
        this.ranges.length = 0;
        // set Active Editor
        this.activeEditor = activeEditor;
        // replace by spaces
        this.text = this.replaceCommentsAndStrings(this.activeEditor.document.getText());

        this.hightlightFunctions();

        // slow function
        activeEditor.setDecorations(this.decoration, this.ranges);
    }
}
exports.Parser = Parser;