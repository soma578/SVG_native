// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { test, BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * デバッグ/レコーディング用のベースURL
 */
const DEMO_URL = 'https://svgmap.org/demos/demo1/';

/**
 * ローカルのJS/HTMLファイルをブラウザに読み込ませるためのルーティング設定
 */
async function applyLocalRouting(context: BrowserContext) {
    const rootDir = process.cwd();
    // プロジェクト構造に合わせて検索ディレクトリを指定
    const searchDirs = [
        rootDir, 
        path.join(rootDir, 'libs'), 
        path.join(rootDir, '3D_extension')
    ];

    await context.route('**/*.{js,html}', async (route) => {
        const url = new URL(route.request().url());
        const fileName = url.pathname.split('/').pop()?.split('?')[0];
        if (!fileName) return route.continue();

        let foundPath = null;
        for (const dir of searchDirs) {
            const targetPath = path.join(dir, fileName);
            if (fs.existsSync(targetPath) && fs.lstatSync(targetPath).isFile()) {
                foundPath = targetPath;
                break;
            }
        }

        if (foundPath) {
            const contentType = fileName.endsWith('.js') ? 'application/javascript' : 'text/html';
            await route.fulfill({ 
                body: fs.readFileSync(foundPath), 
                contentType: contentType 
            });
        } else {
            await route.continue();
        }
    });
}

test('Recording Session: Local Routing', async ({ page, context }) => { 
    // 1. ルーティングの適用
    await applyLocalRouting(context);

    // 2. ターゲットURLへ移動
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });

    // 3. 一時停止（Playwright Inspectorが起動し、ここからレコーディング可能）
    await page.pause(); 
});
