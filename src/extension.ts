// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Parser } from 'node-sql-parser';

interface IParser {
    astify(text: string): any;
    sqlify(ast: any): any;
}

class NodeSqlParser implements IParser {
    parser = new Parser();
    opt = {
        database: 'mysql'
    };
    astify(text: string): any {
        return this.parser.astify(text, this.opt);
    };
    sqlify(ast: any): string {
        return this.parser.sqlify(ast, this.opt);
    };
};

const test_query = `
insert into users (id, name) values (1, 'hoge');
insert users (id, name) values (1, 'hoge');
insert users (id, name) values (1, 'hoge'), (2, 'fuga');
insert into users set id = 1, name = 'hoge', status = 0;
`;

export function activate(context: vscode.ExtensionContext) {

    let disposable_conv2values = vscode.commands.registerCommand('extension.conv2values', () => {
        textConv(set2values);
    });

    let disposable_conv2set = vscode.commands.registerCommand('extension.conv2set', () => {
        textConv(values2set);
    });

    context.subscriptions.push(
        disposable_conv2values,
        disposable_conv2set
    );
}

function textConv(converter: (ast: any) => void): void {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        // エディタが取れない場合
        throw new Error('Active text editor not found.');
    }
    let doc = editor.document;
    let cur_selection = editor.selection;
    if (editor.selection.isEmpty) {
        // 選択範囲が空であれば全てを選択範囲にする
        let startPos = new vscode.Position(0, 0);
        let endPos = new vscode.Position(doc.lineCount - 1, 10000);
        cur_selection = new vscode.Selection(startPos, endPos);
    }
    let text: string = doc.getText(cur_selection);

    editor.edit(edit => {
        edit.replace(cur_selection, sqlConv(new NodeSqlParser, text, converter));
    });
}

function sqlConv(parser: IParser, text: string, converter: (ast: any) => void): string {
    let query_list = text2QueryList(text);
    let output_list: string[] = [];
    for (let query of query_list) {
        if (/^INSERT/i.test(query)) {
            let reg = /^(INSERT) +?(?!INTO )/i;
            let ast = parser.astify(query.replace(reg, '$1 INTO '));
            converter(ast);
            query = parser.sqlify(ast).replace(/ (;) /g, "$1\n") + ";";
        }
        output_list.push(query);
    }
    return output_list.join('');
}

function text2QueryList(text: string): string[] {
    let query_list = text.split(/(INSERT .+?;)/gis);
    return query_list;
}

function set2values(ast_list: any) {
    for (let ast of ast_list) {
        // setのastをvaluesのastに変換する
        if ('set' in ast) {
            let set_list = ast.set;
            delete ast.set;
            let column_list = [];
            let value_list = [];
            for (let set_item of set_list) {
                column_list.push(set_item.column);
                value_list.push(set_item.value);
            }
            ast.columns = column_list;
            ast.values = [{
                "type": "expr_list",
                "value": value_list
            }];
        }
    }
}

function values2set(ast_list: any) {
    for (let ast of ast_list) {
        // valuesのastをsetに変換する
        if ('values' in ast) {
            let columns_list = ast.columns;
            if (!columns_list) {
                throw new Error('has not columns');
            }
            let values_list = ast.values;
            delete ast.columns;
            delete ast.values;
            let set_list = [];
            for (let i = 0; i < columns_list.length; i++) {
                set_list.push({
                    "column": columns_list[i],
                    "value": values_list[0].value[i],
                    "table": null
                });
            }
            ast.set = set_list;
        }
    }
}

export function deactivate() { }
