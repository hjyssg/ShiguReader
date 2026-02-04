
import express, { Request, Response } from 'express';
const router = express.Router();
import { GoodAuthorNamesResponse } from '@common';

const db = require("../models/db");
const serverUtil = require("../utils/server-util");


async function getGoodAndOtherSet(): Promise<GoodAuthorNamesResponse> {
    // let beg = (new Date).getTime();
    let sql;
    let authorInfo = [];
    let tagInfo = [];


    sql = `SELECT * FROM tag_table WHERE type='author'   `;
    authorInfo = await db.doSmartAllSync(sql, []);

    sql = ` SELECT * FROM tag_table WHERE type='tag'  `;
    tagInfo = await db.doSmartAllSync(sql, []);

    // let end = (new Date).getTime();
    // console.log(`[/api/getGoodAuthorNames] ${(end - beg) / 1000}s`);
    return {
        authorInfo,
        tagInfo,
        failed: false
    }
}

router.get('/api/getGoodAuthorNames', serverUtil.asyncWrapper(async (req: Request, res: Response) => {
    const result = await getGoodAndOtherSet();
    // res.setHeader('Cache-Control', 'public, max-age=20');
    res.send(result);
}));

export default router;
