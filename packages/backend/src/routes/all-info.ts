
import express, { Request, Response } from 'express';
const router = express.Router();
import * as util from '@common';
import { TagResponse, AuthorResponse, TagInfo } from '@common';
import _ from "underscore";

const serverUtil = require("../utils/server-util");
const db = require("../models/db");
const nameParser = require('../../../name-parser');

async function add_col(rows: TagInfo[]) {
    for (let ii = 0; ii < rows.length; ii++) {
        const row = rows[ii];
        row.thumbnail = serverUtil.joinThumbnailFolderPath(row.thumbnailFileName);
    }
}

function getSql(tableName: string) {
    return `
    SELECT 
        tt.tag, 
        tt.type, 
        tt.subtype,
        MAX(ft.mTime) AS maxTime, 
        COUNT(tt.tag) AS count, 
        MAX(th.thumbnailFileName) AS thumbnailFileName
    FROM 
        ${tableName} tt
    INNER JOIN 
        file_table ft ON tt.filePath = ft.filePath
    LEFT JOIN 
        thumbnail_table th ON ft.filePath = th.filePath AND th.thumbnailFileName IS NOT NULL
    GROUP BY 
        tt.tag, tt.type, tt.subtype
    HAVING 
        COUNT(tt.tag) >= 3
    `
}

router.post('/api/get_authors', serverUtil.asyncWrapper(async (req: Request, res: Response) => {
    // const needThumbnail = req.body && req.body.needThumbnail;
    let sql = getSql("author_view");
    let author_rows = await db.doSmartAllSync(sql);
    await add_col(author_rows);

    const result: AuthorResponse = {
        author_rows,
        failed: false
    };
    res.send(result);
}));

router.post('/api/get_tags', serverUtil.asyncWrapper(async (req: Request, res: Response) => {
    // const needThumbnail = req.body && req.body.needThumbnail;
    let sql = getSql("tag_view");
    let tag_rows = await db.doSmartAllSync(sql);
    await add_col(tag_rows);

    const result: TagResponse = {
        tag_rows,
        failed: false
    };
    res.send(result);
}));

//直接把tag结果传给前端，提高性能。失败也不影响使用
router.get('/api/getParseCache/', serverUtil.asyncWrapper(async (req: Request, res: Response) => {
    const logLabel = '[/api/getParseCache/]';
    const time1 = util.getCurrentTime();

    const localCache = nameParser.getLocalCache();
    const size = Object.keys(localCache).length;
    if (size > 5000) {
        res.setHeader('Cache-Control', 'public, max-age=600');
    }
    res.send(localCache);

    const time2 = util.getCurrentTime();
    const timeUsed = (time2 - time1);
    // logger.debug(logLabel, size, "  ", timeUsed, "ms")
}));

router.post('/api/info/get_all', serverUtil.asyncWrapper(async (req: Request, res: Response) => {
    let sql = `SELECT filePath, size, mTime  FROM file_table WHERE isDisplayableInExplorer `;
    let rows = await db.doSmartAllSync(sql);
    const fileInfos = serverUtil.convertFileRowsIntoFileInfo(rows);

    res.send({
        fileInfos
    });
}));

export default router;
