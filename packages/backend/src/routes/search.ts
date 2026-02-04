
import express, { Request, Response } from "express";
const router = express.Router();
import {
    searchGenerally,
    searchByText,
    _searchByTag_,
} from "../utils/search-util";
import { MODE_TAG, MODE_AUTHOR, MODE_SEARCH } from '../../../common/src';
import path from "path";
const serverUtil = require("../utils/server-util");
const BookCompareUtil = require("../utils/book-compare");
const {
    TOTALLY_DIFFERENT,
    isTwoBookTheSame,
    extractMiddleChars,
} = BookCompareUtil;
const estimateFileDb = require("../models/estimate-file-db");

// three para 1.mode 2.text
router.post(
    "/api/search/search_file",
    serverUtil.asyncWrapper(async (req: Request, res: Response) => {
        const mode = req.body && req.body.mode;
        const textParam = req.body && req.body.text;

        const tag = mode === MODE_TAG && textParam;
        const author = mode === MODE_AUTHOR && textParam;
        const text = mode === MODE_SEARCH && textParam;

        if (!author && !tag && !text) {
            res.send({ failed: true, reason: "No parameter" });
        } else {
            const temp = await searchGenerally(tag, author, text);
            res.send(temp);
        }
    })
);

router.post(
    "/api/search/simple_search/:text",
    serverUtil.asyncWrapper(async (req: Request, res: Response) => {
        const text = req.params.text;
        const temp = await searchByText(text);
        const { explorerfileResult } = temp;

        const fn = (filePath: string) => path.basename(filePath, path.extname(filePath));

        res.send(explorerfileResult.map((e: any) => fn(e.fileName)));
    })
);

router.post("/api/search/find_similar_file/:text", serverUtil.asyncWrapper(async (req: Request, res: Response) => {
    const text = req.params.text;
    let fileRows: any[] = [];
    let estimateRows: any[] = [];
    const parseResult = serverUtil.parse(text);

    if (parseResult) {
        if (parseResult.author) {
            const temp = await _searchByTag_(parseResult.author, "author");
            fileRows.push(...temp.explorerfileResult);

            const tempEstimate = await estimateFileDb.findEstimateByText(parseResult.author);
            estimateRows.push(...tempEstimate);
        }
        if (parseResult.title) {
            const middleTitle = extractMiddleChars(parseResult.title);
            const temp = await searchByText(middleTitle);
            fileRows.push(...temp.explorerfileResult);

            const tempEstimate = await estimateFileDb.findEstimateByText(middleTitle);
            estimateRows.push(...tempEstimate);
        }
    }

    const middleTitle = extractMiddleChars(text);
    const temp = await searchByText(middleTitle);
    fileRows.push(...temp.explorerfileResult);

    const tempEstimate = await estimateFileDb.findEstimateByText(middleTitle);
    estimateRows.push(...tempEstimate);

    const result: any[] = [];
    const resultMap = new Map();

    function merge(rows: any[], bonus: number) {
        for (const row of rows) {
            if (!row || !row.fileName) {
                continue;
            }

            const fn = row.fileName;
            const rawScore = isTwoBookTheSame(text, fn) + bonus;
            if (rawScore < TOTALLY_DIFFERENT) {
                continue;
            }

            const existing = resultMap.get(fn);
            const filePath = row.filePath || null;
            const isVideo = row.isVideo;
            const isCompress = row.isCompress;
            const isFolder = row.isFolder;

            if (!existing) {
                const item = {
                    fn,
                    score: rawScore,
                    filePath,
                    isVideo,
                    isCompress,
                    isFolder,
                };
                resultMap.set(fn, item);
                result.push(item);
                continue;
            }

            existing.score = Math.max(existing.score, rawScore);
            if (!existing.filePath && filePath) {
                existing.filePath = filePath;
            }
            if (row.isVideo !== undefined) {
                existing.isVideo = row.isVideo;
            }
            if (row.isCompress !== undefined) {
                existing.isCompress = row.isCompress;
            }
            if (row.isFolder !== undefined) {
                existing.isFolder = row.isFolder;
            }
        }
    }

    merge(fileRows, 0);
    merge(estimateRows, 0);

    result.sort((a, b) => b.score - a.score);
    res.send(result);
}));

export default router;
