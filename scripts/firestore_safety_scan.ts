#!/usr/bin/env ts-node
/**
 * 🔒 FIRESTORE SAFETY SCANNER
 * Detects unsafe Firestore patterns:
 * 1) onSnapshot() with < 3 arguments (missing error callback)
 * 2) await getDoc/getDocs/etc. NOT wrapped in try/catch
 */

import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

interface UnsafePattern {
  file: string;
  line: number;
  type: "onSnapshot-no-error" | "await-firestore-no-catch";
  snippet: string;
}

const FIRESTORE_ASYNC_METHODS = [
  "getDoc",
  "getDocs",
  "addDoc",
  "setDoc",
  "updateDoc",
  "deleteDoc",
  "runTransaction",
  "getCountFromServer",
];

const patterns: UnsafePattern[] = [];

function scanFile(filePath: string) {
  const sourceCode = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );

  function visit(node: ts.Node) {
    // A1) Check onSnapshot calls with < 3 args
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const exprText = expr.getText(sourceFile);
      
      if (exprText.endsWith("onSnapshot")) {
        if (node.arguments.length < 3) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          const snippet = node.getText(sourceFile).slice(0, 80);
          patterns.push({
            file: filePath,
            line: line + 1,
            type: "onSnapshot-no-error",
            snippet: snippet + (snippet.length >= 80 ? "..." : ""),
          });
        }
      }
      
      // A2) Check await Firestore calls NOT in try/catch
      if (FIRESTORE_ASYNC_METHODS.some(method => exprText.endsWith(method))) {
        // Check if this call is awaited
        let parent = node.parent;
        let isAwaited = false;
        let inTryCatch = false;
        
        // Check if awaited
        while (parent) {
          if (ts.isAwaitExpression(parent) && parent.expression === node) {
            isAwaited = true;
            break;
          }
          parent = parent.parent;
        }
        
        if (isAwaited) {
          // Check if in try/catch
          let ancestor: ts.Node | undefined = node;
          while (ancestor) {
            if (ts.isTryStatement(ancestor)) {
              inTryCatch = true;
              break;
            }
            ancestor = ancestor.parent;
          }
          
          // Also check for .catch() chained
          let hasCatch = false;
          if (node.parent && ts.isPropertyAccessExpression(node.parent)) {
            const propName = node.parent.name.getText(sourceFile);
            if (propName === "catch") {
              hasCatch = true;
            }
          }
          
          if (!inTryCatch && !hasCatch) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            const snippet = node.getText(sourceFile).slice(0, 80);
            patterns.push({
              file: filePath,
              line: line + 1,
              type: "await-firestore-no-catch",
              snippet: snippet + (snippet.length >= 80 ? "..." : ""),
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (
      (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) &&
      !filePath.includes(".bak") &&
      !filePath.includes("node_modules")
    ) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function main() {
  // __dirname will be scripts/dist after compilation, so we need ../../src
  const srcDir = path.resolve(__dirname, "../../src");
  const files = getAllFiles(srcDir);

  console.log(`🔍 Scanning ${files.length} files for unsafe Firestore patterns...\n`);

  files.forEach((file) => scanFile(file));

  // Sort by file then line
  patterns.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  // Print report
  if (patterns.length === 0) {
    console.log("✅ No unsafe Firestore patterns found!");
    process.exit(0);
  }

  console.log(`❌ Found ${patterns.length} unsafe patterns:\n`);

  let currentFile = "";
  patterns.forEach((p) => {
    if (p.file !== currentFile) {
      currentFile = p.file;
      console.log(`\n📄 ${p.file}`);
    }
    console.log(`  Line ${p.line}: [${p.type}]`);
    console.log(`    ${p.snippet}`);
  });

  console.log(`\n❌ Total: ${patterns.length} unsafe patterns`);
  console.log(`\nBreakdown:`);
  const onSnapshotCount = patterns.filter(p => p.type === "onSnapshot-no-error").length;
  const awaitCount = patterns.filter(p => p.type === "await-firestore-no-catch").length;
  console.log(`  - onSnapshot without error callback: ${onSnapshotCount}`);
  console.log(`  - await Firestore without try/catch: ${awaitCount}`);

  process.exit(1);
}

main();
