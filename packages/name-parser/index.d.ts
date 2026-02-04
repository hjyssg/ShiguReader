
export interface ParseResult {
    dateTag?: string;
    group?: string;
    author?: string;
    authors?: string[];
    tags?: string[];
    charNames?: string[];
    extraTags?: string[];
    rawTags?: string[];
    comiket?: string;
    type?: string;
    title?: string;
}

export function parse(str: string): ParseResult | null;
export function isUselessTag(str: string): boolean;
export function isMediaType(str: string): boolean;
export function getMediaType(str: string): string;
export function belongToEvent(str: string): boolean;
export function convertYearString(y: string): number;
export function editDistance(s: string, t: string): number;
export function getDateFromStr(str: string): Date | undefined;
export function getDateFromComiket(comiket: string): Date | null;
export function getDateFromParse(str: string): Date | undefined;
export function getLocalCache(): Record<string, any>;
export function setLocalCache(newLocache: Record<string, any>): void;
export function isHighlySimilar(s1: string, s2: string): boolean;
