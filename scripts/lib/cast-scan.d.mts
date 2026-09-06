export function stripCommentsAndStrings(src: string): string;
export function countCasts(src: string): { asAny: number; asNever: number };
export function scanDir(dir: string): { asAny: number; asNever: number };
