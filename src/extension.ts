// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { BSL_MODE } from "./const";
import { Global } from "./global";

import CompletionItemProvider from "./features/completionItemProvider";
import DefinitionProvider from "./features/definitionProvider";
import DocumentFormattingEditProvider from "./features/documentFormattingEditProvider";
import DocumentSymbolProvider from "./features/documentSymbolProvider";
import HoverProvider from "./features/hoverProvider";
import LintProvider from "./features/lintProvider";
import ReferenceProvider from "./features/referenceProvider";
import SignatureHelpProvider from "./features/signatureHelpProvider";
import SyntaxHelper from "./features/syntaxHelper";
import WorkspaseSymbolProvider from "./features/workspaceSymbolProvider";

import * as bslGlobals from "./features/bslGlobals";
import * as dynamicSnippets from "./features/dynamicSnippets";
import * as oscriptStdLib from "./features/oscriptStdLib";
import * as tasksTemplate from "./features/tasksTemplate";
import * as vscAdapter from "./vscAdapter";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    const global = Global.create(vscAdapter);

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(BSL_MODE, new CompletionItemProvider(global), ".", "=")
    );
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(BSL_MODE, new DefinitionProvider(global))
    );
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(BSL_MODE, new DocumentSymbolProvider(global))
    );
    context.subscriptions.push(
        vscode.languages.registerReferenceProvider(BSL_MODE, new ReferenceProvider(global))
    );
    context.subscriptions.push(
        vscode.languages.registerWorkspaceSymbolProvider(new WorkspaseSymbolProvider(global))
    );
    context.subscriptions.push(
        vscode.languages.registerSignatureHelpProvider(BSL_MODE, new SignatureHelpProvider(global), "(", ",")
    );
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(BSL_MODE, new HoverProvider(global))
    );
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(BSL_MODE, new DocumentFormattingEditProvider(global))
    );
    context.subscriptions.push(
        vscode.languages.registerDocumentRangeFormattingEditProvider(
            BSL_MODE,
            new DocumentFormattingEditProvider(global)
        )
    );

    const syntaxHelper = new SyntaxHelper(global);
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("syntax-helper", syntaxHelper));

    const linter = new LintProvider();
    linter.activate(context.subscriptions);

    context.subscriptions.push(vscode.commands.registerCommand("language-1c-bsl.update", () => {
        global.updateCache();
    }));

    context.subscriptions.push(vscode.commands.registerCommand("language-1c-bsl.createComments", () => {
        if (vscode.window.activeTextEditor.document.languageId === "bsl") {
            const configuration = vscode.workspace.getConfiguration("language-1c-bsl");
            const aL: any = configuration.get("languageAutocomplete");
            const editor = vscode.window.activeTextEditor;
            const positionStart = vscode.window.activeTextEditor.selection.anchor;
            const positionEnd = vscode.window.activeTextEditor.selection.active;
            const lineMethod = (positionStart.line > positionEnd.line) ? positionStart.line + 1 : positionEnd.line + 1;
            const re = /^(Процедура|Функция|procedure|function)\s*([\wа-яё]+)/im;
            for (let indexLine = lineMethod; indexLine >= 0; --indexLine) {
                const matchMethod = re.exec(editor.document.lineAt(indexLine).text);
                if (!matchMethod) {
                    continue;
                }
                const isFunc = (matchMethod[1].toLowerCase() === "function" || matchMethod[1].toLowerCase() === "функция");
                let comment = "";
                let methodDescription = "";
                if (aL === "en") {
                    methodDescription = (isFunc) ? "Function description" : "Procedure description";
                } else {
                    methodDescription = (isFunc) ? "Описание функции" : "Описание процедуры";
                }
                comment += "// <" + methodDescription + ">\n";
                const params = global.getCacheLocal(editor.document.fileName, matchMethod[2], editor.document.getText(), false, false)[0]._method.Params;
                if (params.length > 0) {
                    comment += "//\n";
                    comment += ((aL === "en") ? "// Parameters:\n" : "// Параметры:\n");
                }
                for (let index = 0; index < params.length; index++) {
                    const element = params[index];
                    comment += "//   " + element + ((aL === "en") ? " - <Type.Subtype> - <parameter description>" : " - <Тип.Вид> - <описание параметра>");
                    comment += "\n";
                }
                if (isFunc) {
                    comment += "//\n";
                    comment += ((aL === "en") ? "//  Returns:\n" : "//  Возвращаемое значение:\n");
                    comment += ((aL === "en") ? "//   <Type.Subtype> - <returned value description>" : "//   <Тип.Вид> - <описание возвращаемого значения>");
                    comment += "\n";
                }
                comment += "//\n";
                editor.edit((editBuilder) => {
                    editBuilder.replace(new vscode.Position(indexLine, 0), comment);
                });
            }
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand("language-1c-bsl.createTasks", () => {
        const rootPath = vscode.workspace.rootPath;
        if (!rootPath) {
            return;
        }
        const vscodePath = path.join(rootPath, ".vscode");
        const promise = new Promise((resolve, reject) => {
            fs.stat(vscodePath, (statErr: NodeJS.ErrnoException, stats: fs.Stats) => {
                if (statErr) {
                    fs.mkdir(vscodePath, (mkdirErr) => {
                        if (mkdirErr) {
                            reject(mkdirErr);
                        }
                        resolve();
                    });
                    return;
                }
                resolve();
            });
        });

        promise.then((result) => {
            const tasksPath = path.join(vscodePath, "tasks.json");
            fs.stat(tasksPath, (statErr: NodeJS.ErrnoException, stats: fs.Stats) => {
                if (statErr) {
                    fs.writeFile(
                        tasksPath,
                        JSON.stringify(tasksTemplate.getTasksObject(), undefined, 4),
                        (writeErr: NodeJS.ErrnoException) => {
                            if (writeErr) {
                                throw writeErr;
                            }
                            vscode.window.showInformationMessage("tasks.json was created");
                        });
                } else {
                    vscode.window.showInformationMessage("tasks.json already exists");
                }
            });
        }).catch((reason) => {
            throw reason;
        });
    }));

    vscode.languages.setLanguageConfiguration("bsl", {
        indentationRules: {
            decreaseIndentPattern: /^\s*(конецесли|конеццикла|конецпроцедуры|конецфункции|иначе|иначеесли|конецпопытки|исключение|endif|enddo|endprocedure|endfunction|else|elseif|endtry|except).*$/i,
            increaseIndentPattern: /^\s*(пока|процедура|функция|если|иначе|иначеесли|попытка|исключение|для|while|procedure|function|if|else|elseif|try|for)[^;]*$/i
        },
        comments: {
            lineComment: "//"
        },
        __characterPairSupport: {
            autoClosingPairs: [
                { open: "{", close: "}" },
                { open: "[", close: "]" },
                { open: "(", close: ")" },
                { open: "\"", close: "\"", notIn: ["string"] },
                { open: "'", close: "'", notIn: ["string", "comment"] },
                { open: "`", close: "`", notIn: ["string", "comment"] }
            ]
        },
        brackets: [
            ["{", "}"],
            ["[", "]"],
            ["(", ")"]
        ],
        onEnterRules: [
            {
                beforeText: /^\s*\|([^\"]|"[^\"]*")*$/,
                action: { indentAction: vscode.IndentAction.None, appendText: "|" }
            },
            {
                beforeText: /^([^\|\"]|"[^\"]*")*\"[^\"]*$/,
                action: { indentAction: vscode.IndentAction.None, appendText: "|" }
            }
        ]
    });

    vscode.languages.setLanguageConfiguration("sdbl", {

        comments: {
            lineComment: "//"
        },
        brackets: [
            ["{", "}"],
            ["[", "]"],
            ["(", ")"]
        ]
    });

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(async (textDocumentChangeEvent: vscode.TextDocumentChangeEvent) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== "bsl") {
            return;
        }

        const autoClosingBrackets = Boolean(vscode.workspace.getConfiguration("editor.autoClosingBrackets"));
        if (textDocumentChangeEvent.contentChanges[0].text.slice(-1) === "(") {
            const contentChange = textDocumentChangeEvent.contentChanges[0];
            const point = contentChange.range.start.character + contentChange.text.length;
            const position = new vscode.Position(editor.selection.active.line, point);
            if (autoClosingBrackets) {
                await editor.edit((editBuilder) => {
                    editBuilder.insert(new vscode.Position(position.line, position.character), ")");
                });
            }
            vscode.commands.executeCommand("editor.action.triggerParameterHints");
            vscode.window.activeTextEditor.selection = new vscode.Selection(
                position.line,
                position.character,
                position.line,
                position.character
            );
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand("language-1c-bsl.addComment", () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.selection.isEmpty || editor.document.languageId !== "bsl") {
            return;
        }
        const position = editor.selection.active;

        const line = editor.document.lineAt(position.line);
        const indent = editor.document.getText(
            new vscode.Range(
                line.lineNumber,
                0,
                line.lineNumber,
                line.firstNonWhitespaceCharacterIndex
            )
        );


        if (line.text.match(/^\s*\/\/.*$/)) {
            editor.edit((editBuilder) => {
                editBuilder.insert(new vscode.Position(position.line, position.character), "\n" + indent + "//");
            });
        } else {
            editor.edit((editBuilder) => {
                editBuilder.insert(new vscode.Position(position.line, position.character), "\n" + indent);
            });
        }
    }));

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((textEditor: vscode.TextEditor) => {
        if (!textEditor) {
            return;
        }
        if (!global.cache.getCollection(textEditor.document.fileName)) {
            global.getRefsLocal(textEditor.document.fileName, textEditor.document.getText());
        }
        if (vscode.workspace.rootPath) {
            for (let index = 0; index < vscode.workspace.textDocuments.length; index++) {
                const element = vscode.workspace.textDocuments[index];
                if (element.isDirty && element.languageId === "bsl") {
                    global.customUpdateCache(element.getText(), element.fileName);
                }
            }
        }
    }));

    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(function (document: vscode.TextDocument) {
        if (vscode.workspace.rootPath) {
            global.customUpdateCache(document.getText(), document.fileName);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand("language-1c-bsl.expandAbbreviation", () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.selection.isEmpty) {
            vscode.commands.executeCommand("tab");
            return;
        }
        const position = editor.selection.active;
        if (position.character > 1) {
            const char = editor.document.getText(new vscode.Range(
                new vscode.Position(position.line, position.character - 2), position));
            const textline = editor.document.getText(
                new vscode.Range(
                    new vscode.Position(position.line, 0),
                    new vscode.Position(position.line, position.character - 2)
                )
            );
            const regex = /([а-яё_\w]+\s?)$/i;
            const arrStrings = regex.exec(textline);
            if ((char === "++" || char === "--" || char === "+=" || char === "-=" || char === "*=" || char === "/=" || char === "%=") && editor.selection.isEmpty && arrStrings) {
                const word = arrStrings[1];
                editor.edit(function (editBuilder) {
                    let postfix = undefined;
                    switch (char) {
                        case "++":
                            postfix = " + 1;";
                            break;
                        case "--":
                            postfix = " - 1;";
                            break;
                        case "+=":
                            postfix = " + ";
                            break;
                        case "-=":
                            postfix = " - ";
                            break;
                        case "*=":
                            postfix = " * ";
                            break;
                        case "/=":
                            postfix = " / ";
                            break;
                        case "%=":
                            postfix = " % ";
                            break;
                        default:
                    }
                    editBuilder.replace(
                        new vscode.Range(
                            new vscode.Position(
                                position.line,
                                position.character - word.length - 2
                            ),
                            position
                        ),
                        word + " = " + word + postfix
                    );
                }).then(() => {
                    const position = editor.selection.isReversed ? editor.selection.anchor : editor.selection.active;
                    editor.selection = new vscode.Selection(
                        position.line,
                        position.character,
                        position.line,
                        position.character
                    );
                });
            } else {
                editor.edit((editBuilder) => {
                    vscode.commands.executeCommand("tab");
                });
            }
        } else {
            editor.edit((editBuilder) => {
                vscode.commands.executeCommand("tab");
            });
        }

    }));

    context.subscriptions.push(vscode.commands.registerCommand("language-1c-bsl.dynamicSnippets", () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            return;
        }
        const dynamicSnippetsCollection = {};
        for (const element in dynamicSnippets.dynamicSnippets()) {
            const snippet = dynamicSnippets.dynamicSnippets()[element];
            dynamicSnippetsCollection[element] = snippet;
        }
        const configuration = vscode.workspace.getConfiguration("language-1c-bsl");
        const userDynamicSnippetsList: Array<string> = configuration.get("dynamicSnippets", []);
        for (const index in userDynamicSnippetsList) {
            try {
                const userDynamicSnippetsString = fs.readFileSync(userDynamicSnippetsList[index], "utf-8");
                const snippetsData = JSON.parse(userDynamicSnippetsString);
                for (const element in snippetsData) {
                    const snippet = snippetsData[element];
                    dynamicSnippetsCollection[element] = snippet;
                }
            } catch (error) {
                console.error(error);
            }
        }
        const items = [];
        for (const element in dynamicSnippetsCollection) {
            const snippet = dynamicSnippetsCollection[element];
            const description = (element === snippet.description) ? "" : snippet.description;
            items.push({ label: element, description: description });
        }

        vscode.window.showQuickPick(items).then((selection) => {
            if (!selection) {
                return;
            }
            const indent = editor.document.getText(
                new vscode.Range(
                    editor.selection.start.line,
                    0,
                    editor.selection.start.line,
                    editor.selection.start.character
                )
            );
            let snippetBody: string = dynamicSnippetsCollection[selection.label].body;
            snippetBody = snippetBody.replace(/\n/gm, "\n" + indent);
            const t = editor.document.getText(editor.selection);
            const arrSnippet = snippetBody.split("$1");
            if (arrSnippet.length === 1) {
                editor.edit((editBuilder) => {
                    editBuilder.replace(editor.selection, snippetBody.replace("$0", t));
                }).then(() => {
                    const position = editor.selection.isReversed ? editor.selection.anchor : editor.selection.active;
                    editor.selection = new vscode.Selection(
                        position.line,
                        position.character,
                        position.line,
                        position.character
                    );
                });
            } else {
                editor.edit((editBuilder) => {
                    editBuilder.replace(editor.selection, snippetBody.split("$1")[1].replace("$0", t));
                }).then(() => {
                    const position = editor.selection.isReversed ? editor.selection.active : editor.selection.anchor;
                    editor.selection = new vscode.Selection(
                        position.line,
                        position.character,
                        position.line,
                        position.character
                    );
                    editor.edit((editBuilder) => {
                        editBuilder.insert(editor.selection.active, snippetBody.split("$1")[0].replace("$0", t));
                    });
                });
            }
        });
    }));

    const previewUriString = "syntax-helper://authority/Синтакс-Помощник";
    const previewUri = vscode.Uri.parse(previewUriString);

    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(
        BSL_MODE, new DocumentFormattingEditProvider(global), "и", "ы", "е", "а", "e", "n", "f", "o", "y", "t", "\n"));

    context.subscriptions.push(vscode.commands.registerCommand("language-1c-bsl.syntaxHelper", () => {
        let globalMethod;
        if (vscode.window.activeTextEditor) {
            const word = vscode.window.activeTextEditor.document.getText(
                vscode.window.activeTextEditor.document.getWordRangeAtPosition(
                    vscode.window.activeTextEditor.selection.active
                )
            );
            globalMethod = global.globalfunctions[word.toLowerCase()];
        }
        // push the items
        const items = [];
        items.push({ label: "OneScript", description: "" });
        items.push({ label: "1C", description: "" });
        const postfix = ""; // (autocompleteLanguage === "en") ? "_en" : "";
        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName.endsWith(".bsl") && globalMethod) {
            for (const element in bslGlobals.structureGlobContext()["global"]) {
                const segment = bslGlobals.structureGlobContext()["global"][element];
                if (segment[globalMethod.name] === "" || segment[globalMethod.name] === "") {
                    // let target = (segment[globalMethod.name] === "") ? segment[globalMethod.name] : segment[globalMethod.alias];
                    global.methodForDescription = { label: globalMethod.name, description: "1С/Глобальный контекст/" + element };
                    syntaxHelper.update(previewUri);
                    vscode.commands.executeCommand("vscode.previewHtml", previewUri, vscode.ViewColumn.Two);
                    return;
                }
            }
        } else if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.fileName.endsWith(".os") && globalMethod) {
            for (const element in oscriptStdLib.globalContextOscript()) {
                const segment = oscriptStdLib.globalContextOscript()[element];
                if (segment["methods"][globalMethod.name] !== undefined || segment["methods"][globalMethod.alias] !== undefined) {
                    // let target = (segment["methods"][globalMethod.name] === "") ? segment["methods"][globalMethod.name] : segment["methods"][globalMethod.alias];
                    global.methodForDescription = { label: globalMethod.name, description: "OneScript/Глобальный контекст/" + element };
                    syntaxHelper.update(previewUri);
                    vscode.commands.executeCommand("vscode.previewHtml", previewUri, vscode.ViewColumn.Two);
                    return;
                }
            }
        } else if (!vscode.window.activeTextEditor || vscode.window.activeTextEditor.document.fileName.endsWith(".os")) {
            for (const element in oscriptStdLib.globalContextOscript()) {
                const segment = oscriptStdLib.globalContextOscript()[element];
                for (const sectionTitle in segment) {
                    if (sectionTitle === "description" || sectionTitle === "name" || sectionTitle === "name_en") {
                        continue;
                    }
                    for (const indexMethod in segment[sectionTitle]) {
                        const method = segment[sectionTitle][indexMethod];
                        items.push({ label: method["name" + postfix], description: "OneScript/Глобальный контекст/" + element });
                    }
                }
            }
            for (const element in oscriptStdLib.classesOscript()) {
                const classOscript = oscriptStdLib.classesOscript()[element];
                items.push({ label: classOscript["name" + postfix], description: "OneScript/Классы/" + element });
                for (const sectionTitle in classOscript) {
                    if (sectionTitle === "constructors" || sectionTitle === "description" || sectionTitle === "name" || sectionTitle === "name_en") {
                        continue;
                    }
                    for (const indexMethod in classOscript[sectionTitle]) {
                        const method = classOscript[sectionTitle][indexMethod];
                        items.push({ label: classOscript["name" + postfix] + "." + method["name" + postfix], description: "OneScript/Классы/" + element });
                    }
                }
            }
            for (const element in oscriptStdLib.systemEnum()) {
                const classOscript = oscriptStdLib.systemEnum()[element];
                items.push({ label: classOscript["name" + postfix], description: "OneScript/Системные перечисления/" + element });
                for (const sectionTitle in classOscript) {
                    if (sectionTitle === "description" || sectionTitle === "name" || sectionTitle === "name_en") {
                        continue;
                    }
                    for (const indexMethod in classOscript[sectionTitle]) {
                        const method = classOscript[sectionTitle][indexMethod];
                        items.push({ label: classOscript["name" + postfix] + "." + method["name" + postfix], description: "OneScript/Системные перечисления/" + element });
                    }
                }
            }

        } else if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === "bsl") {
            for (const elementSegment in bslGlobals.structureGlobContext()["global"]) {
                const segment = bslGlobals.structureGlobContext()["global"][elementSegment];
                for (const element in segment) {
                    items.push({ label: element, description: "1С/Глобальный контекст/" + elementSegment });
                }
            }
            for (const elementSegment in bslGlobals.classes()) {
                const class1C = bslGlobals.classes()[elementSegment];
                items.push({ label: elementSegment, description: "1С/Классы/" + elementSegment });
                for (const sectionTitle in class1C) {
                    if (sectionTitle === "constructors" || sectionTitle === "description" || sectionTitle === "name" || sectionTitle === "name_en") {
                        continue;
                    }
                    for (const element in class1C[sectionTitle]) {
                        items.push({ label: elementSegment + "." + element, description: "1С/Классы/" + elementSegment });
                    }
                }
            }
            for (const elementSegment in bslGlobals.systemEnum()) {
                const class1C = bslGlobals.systemEnum()[elementSegment];
                items.push({ label: elementSegment, description: "1С/Системные перечисления/" + elementSegment });
                for (const sectionTitle in class1C) {
                    if (sectionTitle === "description" || sectionTitle === "name" || sectionTitle === "name_en") {
                        continue;
                    }
                    for (const element in class1C[sectionTitle]) {
                        items.push({ label: elementSegment + "." + element, description: "1С/Системные перечисления/" + elementSegment });
                    }
                }
            }
        } else {
            return;
        }
        // pick one
        const options = {
            placeHolder: "Введите название метода",
            matchOnDescription: false
        };
        if (!global.syntaxFilled) {
            if (vscode.window.activeTextEditor.document.fileName.endsWith(".os")) {
                global.methodForDescription = { label: "OneScript", description: "" };
            } else if (vscode.window.activeTextEditor.document.languageId === "bsl") {
                global.methodForDescription = { label: "1C", description: "" };
            }
            syntaxHelper.update(previewUri);
            vscode.commands.executeCommand("vscode.previewHtml", previewUri, vscode.ViewColumn.Two);
        } else {
            vscode.window.showQuickPick(items, options).then(function (selection) {
                if (typeof selection === "undefined") {
                    return;
                }
                global.methodForDescription = selection;
                syntaxHelper.update(previewUri);
                vscode.commands.executeCommand("vscode.previewHtml", previewUri, vscode.ViewColumn.Two);
            });
        }
    }));

    if (vscode.window.activeTextEditor) {
        global.getRefsLocal(
            vscode.window.activeTextEditor.document.fileName,
            vscode.window.activeTextEditor.document.getText()
        );
    }
    global.updateCache();
}

