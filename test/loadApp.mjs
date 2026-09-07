// index.html 内のインライン <script> を抽出し、Node の vm モジュール上で実行して
// window.AmedasApp（DOM/fetch に依存しない純粋関数群）を取得するテスト用ヘルパー。
//
// index.html はブラウザ専用の単一ファイルであるため、このファイルを import せず、
// テスト実行時にのみソースを読み込んで評価する（アプリ本体に一切手を加えない）。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML_PATH = path.join(__dirname, "..", "index.html");

export function loadAmedasApp(){
  const html = readFileSync(INDEX_HTML_PATH, "utf8");
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error("index.html 内に <script> ブロックが見つかりませんでした");
  }
  const scriptText = match[1];

  const sandbox = {
    console,
    Math,
    Date,
    JSON,
    Array,
    Object,
    isFinite,
    // document は意図的に定義しない -> initApp() は実行されない
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(scriptText, sandbox, { filename: "index.html(inline script)" });

  if (!sandbox.AmedasApp) {
    throw new Error("window.AmedasApp がエクスポートされていません");
  }
  return sandbox.AmedasApp;
}
