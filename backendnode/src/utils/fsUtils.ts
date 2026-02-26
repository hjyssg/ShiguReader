import fs from "node:fs";

/**
 * Returns true if the path is accessible with the given mode, false otherwise.
 * Replaces the verbose try/catch(fs.promises.access) pattern throughout the codebase.
 */
export async function fileExists(filePath: string, mode = fs.constants.F_OK): Promise<boolean> {
  try {
    await fs.promises.access(filePath, mode);
    return true;
  } catch {
    return false;
  }
}
