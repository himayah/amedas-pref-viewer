// index.html 内の純粋関数群（window.AmedasApp）に対するユニットテスト。
// DOM/fetch に依存しない計算・幾何ロジックのみを対象とする。
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAmedasApp } from "./loadApp.mjs";

const A = loadAmedasApp();

test("dmsToDecimal: 度分表記を10進数に変換する", () => {
  assert.equal(A.dmsToDecimal([45, 31.2]), 45 + 31.2 / 60);
  assert.equal(A.dmsToDecimal([0, 0]), 0);
});

test("windDirCodeToDeg: JMA風向コード(0-16)を角度に変換する", () => {
  assert.equal(A.windDirCodeToDeg(0), null); // 0 = 静穏
  assert.equal(A.windDirCodeToDeg(null), null);
  assert.equal(A.windDirCodeToDeg(undefined), null);
  assert.equal(A.windDirCodeToDeg(1), 22.5);   // 北北東
  assert.equal(A.windDirCodeToDeg(16), 0);     // 16 % 16 = 0 -> 北
  assert.equal(A.windDirCodeToDeg(8), 180);    // 南
});

test("degToCompass16: 角度を16方位名に変換する", () => {
  assert.equal(A.degToCompass16(0), "北");
  assert.equal(A.degToCompass16(180), "南");
  assert.equal(A.degToCompass16(359), "北");
  assert.equal(A.degToCompass16(null), "―");
  assert.equal(A.degToCompass16(NaN), "―");
});

test("meanOf: 数値のみを対象に平均を計算し、非数値/空配列を無視する", () => {
  assert.equal(A.meanOf([1, 2, 3]), 2);
  assert.equal(A.meanOf([1, null, 3, NaN, "x"]), 2);
  assert.equal(A.meanOf([]), null);
  assert.equal(A.meanOf([null, undefined]), null);
});

test("sumOf: 数値のみを対象に合計を計算する", () => {
  assert.equal(A.sumOf([1, 2, 3]), 6);
  assert.equal(A.sumOf([]), null);
  assert.equal(A.sumOf([10, null, 5]), 15);
});

test("rmsOf: 二乗平均平方根(RMS)を計算する", () => {
  assert.equal(A.rmsOf([3, 4]), Math.sqrt((9 + 16) / 2));
  assert.equal(A.rmsOf([]), null);
  assert.equal(A.rmsOf([5]), 5);
});

test("vectorWindAverage: 同一方向は速度と方向がそのまま平均される", () => {
  const r = A.vectorWindAverage([
    { speed: 4, dirDeg: 90 },
    { speed: 6, dirDeg: 90 },
  ]);
  assert.ok(Math.abs(r.speed - 5) < 1e-9);
  assert.ok(Math.abs(r.dirDeg - 90) < 1e-9);
});

test("vectorWindAverage: 正反対の風は打ち消し合い速度がほぼ0になる", () => {
  const r = A.vectorWindAverage([
    { speed: 5, dirDeg: 0 },
    { speed: 5, dirDeg: 180 },
  ]);
  assert.ok(Math.abs(r.speed) < 1e-9);
});

test("vectorWindAverage: 有効サンプルが無ければ null を返す", () => {
  const r = A.vectorWindAverage([]);
  assert.equal(r.speed, null);
  assert.equal(r.dirDeg, null);
});

test("pointInPolygonCoords: 単純な矩形の内外判定", () => {
  const square = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]];
  assert.equal(A.pointInPolygonCoords(5, 5, square), true);
  assert.equal(A.pointInPolygonCoords(15, 5, square), false);
});

test("pointInPolygonCoords: 穴(hole)のある多角形", () => {
  const outer = [0, 0], size = 10;
  const withHole = [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],       // 外周
    [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],           // 穴
  ];
  assert.equal(A.pointInPolygonCoords(5, 5, withHole), false); // 穴の中
  assert.equal(A.pointInPolygonCoords(1, 1, withHole), true);  // 外周内・穴の外
});

test("pointInGeometry: Polygon / MultiPolygon の両方を判定できる", () => {
  const polygon = { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] };
  assert.equal(A.pointInGeometry(5, 5, polygon), true);

  const multi = {
    type: "MultiPolygon",
    coordinates: [
      [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
      [[[10, 10], [12, 10], [12, 12], [10, 12], [10, 10]]],
    ],
  };
  assert.equal(A.pointInGeometry(11, 11, multi), true);
  assert.equal(A.pointInGeometry(5, 5, multi), false);
});

test("geometryBounds: Polygon の外接矩形を計算する", () => {
  const polygon = { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 5], [0, 5], [0, 0]]] };
  // vm サンドボックス（別レルム）由来のオブジェクトのため、フィールドごとに比較する
  const b = A.geometryBounds(polygon);
  assert.equal(b.lonMin, 0);
  assert.equal(b.lonMax, 10);
  assert.equal(b.latMin, 0);
  assert.equal(b.latMax, 5);
});

test("makeProjector: 緯度経度からピクセル座標へ単調に写像する", () => {
  const bounds = { lonMin: 130, lonMax: 140, latMin: 30, latMax: 40 };
  const proj = A.makeProjector(bounds, 800, 600, 20);
  const topLeft = proj.toXY(bounds.lonMin, bounds.latMax);
  const bottomRight = proj.toXY(bounds.lonMax, bounds.latMin);
  assert.ok(topLeft[0] < bottomRight[0]); // 経度が大きいほどXは右
  assert.ok(topLeft[1] < bottomRight[1]); // 緯度が小さいほどYは下
});

test("idwGrid: 観測点と同一座標では厳密値を返す", () => {
  const bounds = { lonMin: 0, lonMax: 10, latMin: 0, latMax: 10 };
  const points = [{ lon: 0, lat: 10, value: 100 }, { lon: 10, lat: 10, value: 0 }];
  const grid = A.idwGrid(points, bounds, 3, 3, 2);
  assert.equal(grid.values[0], 100); // 左上セル = (0,10) と一致
  assert.equal(grid.values[2], 0);   // 右上セル = (10,10) と一致
});

test("idwGrid: 有効な観測点が無い場合は全セルNaN", () => {
  const bounds = { lonMin: 0, lonMax: 10, latMin: 0, latMax: 10 };
  const grid = A.idwGrid([{ lon: 5, lat: 5, value: NaN }], bounds, 2, 2, 2);
  assert.ok(grid.values.every((v) => Number.isNaN(v)));
});

test("maskGridByGeometry: ジオメトリ外のセルをNaNにする", () => {
  const bounds = { lonMin: 0, lonMax: 2, latMin: 0, latMax: 2 };
  const grid = A.idwGrid([{ lon: 1, lat: 1, value: 42 }], bounds, 2, 2, 2);
  const smallSquare = { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] };
  const masked = A.maskGridByGeometry(grid, smallSquare);
  // 右上セル (lon=2,lat=2) は小さい矩形の外なのでNaNになるはず
  assert.ok(Number.isNaN(masked.values[0]));
});

test("maskGridByGeometry: bufferDegを指定すると境界の外側のセルも残す", () => {
  const bounds = { lonMin: 0, lonMax: 2, latMin: 0, latMax: 2 };
  const grid = A.idwGrid([{ lon: 1, lat: 1, value: 42 }], bounds, 2, 2, 2);
  const smallSquare = { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] };
  // 右上セル(2,2)は境界(1,1)から約1.41度離れている -> buffer 2.0なら残る
  const masked = A.maskGridByGeometry(grid, smallSquare, 2.0);
  assert.ok(!Number.isNaN(masked.values[0]));
});

test("marchingSquaresContours: 単純な勾配グリッドで等高線セグメントが得られる", () => {
  // 2x2グリッド、左から右へ0->10の勾配
  const grid = { values: [0, 10, 0, 10], cols: 2, rows: 2, bounds: { lonMin: 0, lonMax: 1, latMin: 0, latMax: 1 } };
  const result = A.marchingSquaresContours(grid, [5]);
  assert.equal(result.length, 1);
  assert.equal(result[0].level, 5);
  assert.ok(result[0].segments.length >= 1);
});

test("linspace: 指定個数の等間隔な数列を生成する", () => {
  // vm サンドボックス（別レルム）由来の配列のため、Array.from でこのレルムの配列にしてから比較する
  assert.deepEqual(Array.from(A.linspace(0, 10, 5)), [0, 2.5, 5, 7.5, 10]);
  assert.deepEqual(Array.from(A.linspace(3, 3, 1)), [3]);
});

test("valueToColorHsl: 0..1の範囲にクランプしhsl文字列を返す", () => {
  assert.equal(A.valueToColorHsl(0, 0, 100), "hsl(0,85%,50%)");
  assert.equal(A.valueToColorHsl(1, 0, 100), "hsl(100,85%,50%)");
  assert.equal(A.valueToColorHsl(-1, 0, 100), "hsl(0,85%,50%)"); // クランプ
  assert.equal(A.valueToColorHsl(2, 0, 100), "hsl(100,85%,50%)"); // クランプ
});

test("formatJstTimestamp: UTC日時をJSTのYYYYMMDDHHMMSSに変換する", () => {
  // 2026-01-01T00:00:00Z -> JST 2026-01-01 09:00:00
  const d = new Date("2026-01-01T00:00:00Z");
  assert.equal(A.formatJstTimestamp(d), "20260101090000");
});

test("buildTimestamps: 最新時刻から1時間刻みで指定件数を新しい順に生成する", () => {
  const ts = A.buildTimestamps("2026-01-01T12:00:00+09:00", 3, 60);
  assert.equal(ts.length, 3);
  assert.equal(ts[0], "20260101120000");
  assert.equal(ts[1], "20260101110000");
  assert.equal(ts[2], "20260101100000");
});

test("buildTimestamps: 10分刻みでも正しく生成する（過去1時間=6点相当）", () => {
  const ts = A.buildTimestamps("2026-01-01T12:00:00+09:00", 6, 10);
  assert.equal(ts.length, 6);
  assert.equal(ts[0], "20260101120000");
  assert.equal(ts[5], "20260101111000"); // 12:00 - 5*10分 = 11:10
});

test("polygonBounds: 単一ポリゴンの外接矩形を計算する", () => {
  const b = A.polygonBounds([[[0, 0], [10, 0], [10, 5], [0, 5], [0, 0]]]);
  assert.equal(b.lonMin, 0);
  assert.equal(b.lonMax, 10);
  assert.equal(b.latMin, 0);
  assert.equal(b.latMax, 5);
});

test("bboxGapDistance: 重なる矩形は0、離れた矩形は隙間の距離を返す", () => {
  const a = { lonMin: 0, lonMax: 10, latMin: 0, latMax: 10 };
  const b = { lonMin: 5, lonMax: 15, latMin: 5, latMax: 15 };
  assert.equal(A.bboxGapDistance(a, b), 0); // 重なっている

  const c = { lonMin: 20, lonMax: 25, latMin: 0, latMax: 10 };
  assert.equal(A.bboxGapDistance(a, c), 10); // lonの隙間のみ (20-10)
});

test("clusterPolygons: 近い2つの矩形は同一クラスタ、遠い矩形は別クラスタになる", () => {
  const near = {
    type: "MultiPolygon",
    coordinates: [
      [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      [[[1.2, 0], [2.2, 0], [2.2, 1], [1.2, 1], [1.2, 0]]], // 0.2度しか離れていない
    ],
  };
  const nearClusters = A.clusterPolygons(near, 1.0);
  assert.equal(nearClusters.length, 1);

  const far = {
    type: "MultiPolygon",
    coordinates: [
      [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]], // 遠く離れた「離島」
    ],
  };
  const farClusters = A.clusterPolygons(far, 1.0);
  assert.equal(farClusters.length, 2);
});

test("clusterPolygons: Polygon型ジオメトリは常に単一クラスタになる", () => {
  const polygon = { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] };
  const clusters = A.clusterPolygons(polygon, 1.0);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].geometry.type, "Polygon");
});

test("regionLabelFromStationNames: 観測点名から地域選択肢用のラベルを生成する", () => {
  assert.equal(A.regionLabelFromStationNames([]), "離島");
  assert.equal(A.regionLabelFromStationNames(["父島"]), "父島");
  assert.equal(A.regionLabelFromStationNames(["父島", "母島"]), "父島・母島");
  assert.equal(A.regionLabelFromStationNames(["大島", "新島", "神津島"]), "大島・新島他1地点");
});

test("distPointToSegmentSq: 点-線分間の最短距離の2乗を計算する", () => {
  // 水平線分(0,0)-(10,0)の真上(5,3)にある点 -> 距離3
  assert.ok(Math.abs(A.distPointToSegmentSq(5, 3, 0, 0, 10, 0) - 9) < 1e-9);
  // 線分の延長線上（端点より外側）は端点までの距離
  assert.ok(Math.abs(A.distPointToSegmentSq(-4, 0, 0, 0, 10, 0) - 16) < 1e-9);
});

test("pointNearGeometry: ジオメトリ内部は常にtrue、境界付近はバッファ距離内でtrue", () => {
  const square = { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] };
  assert.equal(A.pointNearGeometry(5, 5, square, 0.1), true);   // 内部
  assert.equal(A.pointNearGeometry(10.05, 5, square, 0.1), true);  // 境界から0.05外
  assert.equal(A.pointNearGeometry(11, 5, square, 0.1), false); // 境界から1外（バッファ超え）
});
