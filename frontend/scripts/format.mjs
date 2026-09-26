import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const config = await prettier.resolveConfig(path.join(root, '.prettierrc.json'));

async function filesIn(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map((entry) => {
            const name = path.join(directory, entry.name);
            return entry.isDirectory()
                ? filesIn(name)
                : /\.(tsx?|css|mjs)$/.test(name)
                  ? [name]
                  : [];
        }),
    );
    return nested.flat();
}

function parse(source, filename) {
    return ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
}

function compile(source, filename) {
    return ts.transpileModule(source, {
        fileName: filename,
        compilerOptions: { target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
}

// Compare emitted syntax, including actual JSX text, rather than just trusting whitespace edits.
function fingerprint(node) {
    if (ts.isParenthesizedExpression(node)) return fingerprint(node.expression);
    if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === 'react/jsx-runtime'
    )
        return ['jsx-runtime'];
    if (ts.isIdentifier(node) && /^_jsxs?$/.test(node.text)) return ['jsx-call'];
    if (ts.isPropertyAssignment(node) && node.name.getText() === 'children') {
        const values = ts.isArrayLiteralExpression(node.initializer)
            ? node.initializer.elements
            : [node.initializer];
        const children = [];
        for (const value of values) {
            if (ts.isStringLiteral(value) && typeof children.at(-1) === 'string')
                children[children.length - 1] += value.text;
            else children.push(ts.isStringLiteral(value) ? value.text : fingerprint(value));
        }
        return ['jsx-children', children];
    }
    const children = [];
    ts.forEachChild(node, (child) => {
        children.push(fingerprint(child));
    });
    return [
        node.kind,
        ts.isIdentifier(node) || ts.isLiteralExpression(node) ? node.text : null,
        children,
    ];
}

function jsxTextValue(raw) {
    const compiled = parse(compile(`const value = <span>${raw}</span>;`, 'text.tsx'), 'text.js');
    let value = '';
    function visit(node) {
        if (
            ts.isPropertyAssignment(node) &&
            node.name.getText(compiled) === 'children' &&
            ts.isStringLiteral(node.initializer)
        ) {
            value = node.initializer.text;
        }
        ts.forEachChild(node, visit);
    }
    visit(compiled);
    return value;
}

function applyEdits(source, edits) {
    return edits
        .sort((a, b) => b.start - a.start || b.length - a.length)
        .reduce(
            (text, edit) =>
                text.slice(0, edit.start) + edit.text + text.slice(edit.start + edit.length),
            source,
        );
}

function expandJsx(source, filename) {
    const ast = parse(source, filename);
    const edits = [];
    const insert = (start, text) => edits.push({ start, length: 0, text });
    function visit(node) {
        if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
            if (ts.isReturnStatement(node.parent) || ts.isArrowFunction(node.parent)) {
                insert(node.getStart(ast), '(\n');
                insert(node.end, '\n)');
            }
            const opening = ts.isJsxElement(node) ? node.openingElement : node.openingFragment;
            const closing = ts.isJsxElement(node) ? node.closingElement : node.closingFragment;
            if (!node.children.length) insert(opening.end, '\n');
            else {
                if (!ts.isJsxText(node.children[0])) insert(opening.end, '\n');
                node.children.forEach((child, index) => {
                    if (index && !ts.isJsxText(child) && !ts.isJsxText(node.children[index - 1])) {
                        insert(child.getStart(ast), '\n');
                    }
                });
                if (!ts.isJsxText(node.children.at(-1))) insert(closing.getStart(ast), '\n');
            }
        }
        if (ts.isJsxText(node)) {
            const raw = source.slice(node.pos, node.end);
            const value = jsxTextValue(raw);
            // Explicit string expressions preserve significant spaces next to inline elements.
            const text = !value
                ? ''
                : value.trim() !== value
                  ? `{ ${JSON.stringify(value)} }`
                  : raw.trim();
            edits.push({
                start: node.pos,
                length: node.end - node.pos,
                text: text ? `\n${text}\n` : '\n',
            });
        }
        if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) {
            // Literal text expressions remain compact; conditionals and other children get their own block.
            if (!node.expression || ts.isStringLiteral(node.expression)) return;
            insert(node.getStart(ast) + 1, '\n');
            insert(node.end - 1, '\n');
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    const expanded = applyEdits(source, edits);
    const service = ts.createLanguageService({
        getScriptFileNames: () => [filename],
        getScriptVersion: () => '0',
        getScriptSnapshot: (name) =>
            name === filename ? ts.ScriptSnapshot.fromString(expanded) : undefined,
        getCurrentDirectory: () => root,
        getCompilationSettings: () => ({ jsx: ts.JsxEmit.ReactJSX }),
        getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
    });
    const formatting = service.getFormattingEditsForDocument(filename, {
        ...ts.getDefaultFormatCodeSettings(),
        indentSize: config.tabWidth,
        tabSize: config.tabWidth,
        convertTabsToSpaces: true,
        newLineCharacter: '\n',
        insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
        insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: true,
    });
    service.dispose();
    return applyEdits(
        expanded,
        formatting.map(({ span, newText }) => ({
            start: span.start,
            length: span.length,
            text: newText,
        })),
    ).replace(/\n[\t ]*\n([\t ]*\n)+/g, '\n\n');
}

let changed = 0;
for (const filename of await filesIn(path.join(root, 'src'))) {
    const source = await fs.readFile(filename, 'utf8');
    let formatted = source;
    for (let pass = 0; pass < 5; pass++) {
        let next = await prettier.format(formatted, { ...config, filepath: filename });
        if (filename.endsWith('.tsx')) next = expandJsx(next, filename);
        if (next === formatted) break;
        if (pass === 4) throw new Error(`Formatting did not converge: ${filename}`);
        formatted = next;
    }
    if (/\.tsx?$/.test(filename) && !filename.endsWith('.d.ts')) {
        const before = fingerprint(parse(compile(source, filename), 'before.js'));
        const after = fingerprint(parse(compile(formatted, filename), 'after.js'));
        if (JSON.stringify(before) !== JSON.stringify(after)) {
            throw new Error(`Formatting changed emitted syntax: ${path.relative(root, filename)}`);
        }
    }
    if (formatted !== source) {
        changed++;
        console.log(
            `${check ? 'Needs formatting' : 'Formatted'}: ${path.relative(root, filename)}`,
        );
        if (!check) await fs.writeFile(filename, formatted);
    }
}
console.log(`${changed} file(s) ${check ? 'need formatting' : 'formatted'}.`);
if (check && changed) process.exitCode = 1;
