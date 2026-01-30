
/**
 * 2つの球(半径R)の交円上で、Yが最小(地面寄り)となる点を求める
 * 球中心1: p1, 球中心2: p2, 半径: R
 * 解がない(届かない)場合は null
 */
function calcSphereCenterFrom2Points(p1, p2, R) {
    // 2点間の距離の2乗
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    const dist2 = dx * dx + dy * dy + dz * dz;
    const dist = Math.sqrt(dist2);

    // 届かない場合
    if (dist > 2 * R) return null;
    if (dist === 0) return null; // 同一点

    // 2つの球の中心間の中点 M
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const mz = (p1.z + p2.z) / 2;

    // 交円の半径 r (直角三角形のピタゴラス)
    // R^2 = (dist/2)^2 + r^2  => r = sqrt(R^2 - (dist/2)^2)
    // const h = Math.sqrt(Math.max(0, R * R - (dist / 2) * (dist / 2))); // 中心Mから交円までの距離ではなく、ここは直行ベクトル成分

    // ベクトル P1->P2
    // これに垂直な平面上に交円がある。
    // 単純化: 
    // 求めたい球中心 C は、M から、ベクトル d = P2-P1 に垂直な方向に h だけ移動した点ではない。
    // 解説:
    // 2つの球 (P1, R) と (P2, R) の交わりは円になる。その円上の点はすべて、P1からもP2からも距離Rにある。
    // 今回求めたいのは「球の中心」そのもの。
    // P1, P2 を通る半径Rの球の中心Cは、線分P1P2の垂直二等分面上にあり、かつ P1, P2 からの距離が R となる点。
    // 線分の中点 M からの距離を h とすると、h^2 + (dist/2)^2 = R^2
    // よって h = sqrt(R^2 - dist^2/4)

    // C = M + h * n  (nは線分P1P2に垂直な単位ベクトル)
    // このような n は無数にある(円を描く)が、今回求めたいのは「Yが最小」すなわち一番低い位置に来る C。
    // つまり、M を通り P1P2 に垂直な平面上で、最も Y が小さい点を探す。

    // 1. P1->P2 ベクトル V
    const vx = dx, vy = dy, vz = dz;
    const Vnx = vx / dist;
    const Vny = vy / dist;
    const Vnz = vz / dist;

    // 2. 「真上」に近いベクトルを探す。（外接円盤の上側）
    // Y軸 (0, 1, 0) を平面に投影する。

    const dot = (0 * Vnx) + (1 * Vny) + (0 * Vnz); // = Vny
    const projX = 0 - dot * Vnx;
    const projY = 1 - dot * Vny;
    const projZ = 0 - dot * Vnz;

    const projLenSq = projX * projX + projY * projY + projZ * projZ;

    let dirX, dirY, dirZ;

    if (projLenSq < 1e-8) {
        // 射影が0 → Vが鉛直(Y軸平行)。
        // この場合、円は水平面にあるので、どの点もYは同じ。
        dirX = 1; dirY = 0; dirZ = 0;
    } else {
        const projLen = Math.sqrt(projLenSq);
        dirX = projX / projLen;
        dirY = projY / projLen;
        dirZ = projZ / projLen;
    }

    const h = Math.sqrt(Math.max(0, R * R - dist2 / 4));

    return {
        x: mx + h * dirX,
        y: my + h * dirY,
        z: mz + h * dirZ
    };
}

/**
 * 配列から k 個選ぶ組み合わせを返すジェネレータ
 */
function* getCombinations(array, k) {
    if (k === 0) {
        yield [];
        return;
    }
    for (let i = 0; i < array.length; i++) {
        const head = array[i];
        const tail = array.slice(i + 1);
        for (const c of getCombinations(tail, k - 1)) {
            yield [head, ...c];
        }
    }
}

/**
 * 指定された点群(supportPoints)だけで支持される球を計算する。
 * 3点: 3点を通る球 (2つある場合はYが高い方)
 * 2点: 2点間の"峠"に乗っかる球 (RSMの谷の定義に従う最低点...ではなく、今回は「地面から遠い」が目的なので、
 *      2点に乗る球の中で最も高い位置に来るもの？
 *      いや、回転球体法において「2点で支えられる」とは、その2点を結ぶ線分を軸に回転させたときの軌跡。
 *      最も厳しい（低い）箇所は2点の中間だが、
 *      「3点支持が見つからない場合」に次に検討すべきは「2点支持」。
 *      2点支持の球は、その2点を通る円周常のどこにでも存在しうる。
 *      しかし、「重力で落ちてきて止まる」イメージなら、3点支持で止まるか、
 *      2点支持で止まる（その2点が壁のようになって安定する）つまり、重心が...
 *      
 *      シンプルに:
 *      2点 P1, P2 の場合、その垂直二等分面上かつ P1,P2から距離Rの場所すべてが候補。
 *      その中で「最も地面から遠い（Yが大きい）」場所は、実は無限に高いところ...ではなく、
 *      物理的には「球体は上から降ってくる」ので、最初にひっかかる場所。
 *      しかし、「地面からの距離を知る」のが目的＝保護範囲の確認。
 *      保護範囲の確認であれば、球体は「外部から侵入できる限界の位置」にあるはず。
 *      つまり、2点支持の場合は、その2点の間をすり抜けようとする「最も低い位置」がクリティカル。
 *      ユーザー要望「球体と地面は最も遠い位置にあってほしい」
 *      矛盾するようだが、これは「複数の支持パターン（A,B,Cの3点、あるいはD,Eの2点など）がありうる中で、
 *      『実際に球が止まる位置』＝『最も高い位置（上から降ってくるから）』」という意味と解釈する。
 *      上から巨大な球を降らせて、どこで止まるか？
 *      一番高い位置で止まったなら、それより下には行けない＝それが求める球。
 *      
 *      よって方針：
 *      2点支持の場合も、可能な限り「高い」位置... といっても、2点だけなら球は回転して落ちてしまう。
 *      しかし他のがなければそこで止まると仮定するなら、
 *      「2点の中真上」にバランスよく乗っている状態（重心が直上にある）を計算する。
 *      これは calcSphereCenterFrom2Points で計算している「垂直二等分面上で、Yが最大になる点」そのもの。
 * 
 *      1点の場合: 真上に乗る。
 */
function calcSphereFixedRadiusForSet(supportPoints, R) {
    if (supportPoints.length === 1) {
        const p = supportPoints[0];
        return { center: { x: p.x, y: p.y + R, z: p.z }, radius: R };
    }
    if (supportPoints.length === 2) {
        // calcSphereCenterFrom2Points は既に「Yが最大になる点」を返すように実装されている
        const c = calcSphereCenterFrom2Points(supportPoints[0], supportPoints[1], R);
        if (!c) return null;
        return { center: c, radius: R };
    }
    if (supportPoints.length === 3) {
        // 3点支持の実装 (既存ロジック転用・整理)
        const p1 = supportPoints[0];
        const p2 = supportPoints[1];
        const p3 = supportPoints[2];

        // 平面法線
        const v1x = p2.x - p1.x, v1y = p2.y - p1.y, v1z = p2.z - p1.z;
        const v2x = p3.x - p1.x, v2y = p3.y - p1.y, v2z = p3.z - p1.z;
        let nx = v1y * v2z - v1z * v2y;
        let ny = v1z * v2x - v1x * v2z;
        let nz = v1x * v2y - v1y * v2x;
        const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (nLen < 1e-8) return null; // 一直線
        nx /= nLen; ny /= nLen; nz /= nLen;

        // 3点を通る円の中心(外心) Op を求める
        // Op = P1 + s*V1 + t*V2
        // 連立方程式の解法 (Cramer's rule or optimized)
        // (v1.v1)s + (v1.v2)t = v1.v1 / 2
        // (v1.v2)s + (v2.v2)t = v2.v2 / 2
        //  -> ax + by = e
        //  -> cx + dy = f
        const d11 = v1x * v1x + v1y * v1y + v1z * v1z;
        const d12 = v1x * v2x + v1y * v2y + v1z * v2z;
        const d22 = v2x * v2x + v2y * v2y + v2z * v2z;

        const det = d11 * d22 - d12 * d12;
        if (Math.abs(det) < 1e-8) return null;

        const e = 0.5 * d11;
        const f = 0.5 * d22;

        const s = (e * d22 - f * d12) / det;
        const t = (d11 * f - d12 * e) / det;

        const opX = p1.x + s * v1x + t * v2x;
        const opY = p1.y + s * v1y + t * v2y;
        const opZ = p1.z + s * v1z + t * v2z;

        // 外接円半径の2乗
        const r_circum_sq = (opX - p1.x) ** 2 + (opY - p1.y) ** 2 + (opZ - p1.z) ** 2;
        if (r_circum_sq > R * R) return null; // 届かない

        const k = Math.sqrt(R * R - r_circum_sq);

        // 上側(Y大)を採用
        const c1y = opY + k * ny;
        const c2y = opY - k * ny;

        let finalX, finalY, finalZ;
        if (c1y >= c2y) {
            finalX = opX + k * nx; finalY = c1y; finalZ = opZ + k * nz;
        } else {
            finalX = opX - k * nx; finalY = c2y; finalZ = opZ - k * nz;
        }
        return { center: { x: finalX, y: finalY, z: finalZ }, radius: R };
    }
    return null;
}

/**
 * 球 center, R に対して、すべての点 points が「球面上(接触)」にあるかチェック
 * 1つでも「接していない（内部 または 外部に浮いている）」点があれば false
 * ユーザー要望: "有効な突針全ての先端に接することは絶対条件"
 */
function isTouchingAllPoints(center, R, allPoints) {
    const tol = 1e-3; // 許容誤差 (mmオーダーより少し大きめに)
    const lowerSq = (R - tol) * (R - tol);
    const upperSq = (R + tol) * (R + tol);

    for (const p of allPoints) {
        const d2 = (p.x - center.x) ** 2 + (p.y - center.y) ** 2 + (p.z - center.z) ** 2;
        // 距離の2乗が (R-tol)^2 ～ (R+tol)^2 の範囲外ならNG
        // つまり R-tol <= dist <= R+tol 以外はNG
        if (d2 < lowerSq || d2 > upperSq) {
            return false;
        }
    }
    return true;
}

function calcSphereFixedRadius(points, R) {
    if (!points || points.length === 0) return null;

    let bestSphere = null;
    let maxSupportCount = -1;
    let maxGroundDist = -Infinity;

    // すべての有効な組み合わせについて検討する
    // 優先順位:
    // 1. 支持点数が多い (3点 > 2点 > 1点)
    // 2. 地面からの距離が高い (Yが大きい)
    // ★条件追加: すべてのポイントが接触していること (isTouchingAllPoints)

    // 1. 3点支持の組み合わせ
    if (points.length >= 3) {
        for (const combo of getCombinations(points, 3)) {
            const sphere = calcSphereFixedRadiusForSet(combo, R);
            if (sphere) {
                // ここで「すべての点」が接しているかチェック
                // 以前は isValidSphere (内部になければOK) だったが、
                // 今は "Touch All" が必須。
                if (isTouchingAllPoints(sphere.center, R, points)) {
                    const dist = sphere.center.y - R;
                    if (maxSupportCount < 3) {
                        maxSupportCount = 3;
                        maxGroundDist = dist;
                        bestSphere = sphere;
                    } else {
                        if (dist > maxGroundDist) {
                            maxGroundDist = dist;
                            bestSphere = sphere;
                        }
                    }
                }
            }
        }
    }

    // 2. 2点支持の組み合わせ
    if (points.length >= 2) {
        for (const combo of getCombinations(points, 2)) {
            const sphere = calcSphereFixedRadiusForSet(combo, R);
            if (sphere) {
                if (isTouchingAllPoints(sphere.center, R, points)) {
                    const dist = sphere.center.y - R;

                    // 既に3点支持が見つかっているなら、3点支持優先
                    // ただし、同じ条件(All Touch)を満たすなら支持点数は多い方が幾何学的に安定しやすい...
                    // というより、All Touchを満たすなら、n点支持由来の球であっても、すべての点(N個)で支持されていると言える。
                    // 計算精度上、3点由来の方がズレが少ないかもしれないので、SupportCount優先は維持。

                    if (maxSupportCount < 2) {
                        maxSupportCount = 2;
                        maxGroundDist = dist;
                        bestSphere = sphere;
                    } else if (maxSupportCount === 2) {
                        if (dist > maxGroundDist) {
                            maxGroundDist = dist;
                            bestSphere = sphere;
                        }
                    }
                }
            }
        }
    }

    // 3. 1点支持の組み合わせ
    for (const combo of getCombinations(points, 1)) {
        const sphere = calcSphereFixedRadiusForSet(combo, R);
        if (sphere) {
            if (isTouchingAllPoints(sphere.center, R, points)) {
                const dist = sphere.center.y - R;

                if (maxSupportCount < 1) {
                    maxSupportCount = 1;
                    maxGroundDist = dist;
                    bestSphere = sphere;
                } else if (maxSupportCount === 1) {
                    if (dist > maxGroundDist) {
                        maxGroundDist = dist;
                        bestSphere = sphere;
                    }
                }
            }
        }
    }

    // 条件に合う球が見つからなかった場合(null)はそのまま返る
    // minRequired ロジックは AllPointsTouching により自然に満たされるため削除(または無効化)
    // 例えば4点あって、All Touchを満たす球が見つかれば、それは4点全てに接しているのでOK。
    // 見つからなければ null。

    return bestSphere;
}

// Global scope export
window.SphereCalculator = {
    calcSphereFixedRadius
};
