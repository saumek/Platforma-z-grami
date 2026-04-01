import { mkdir, unlink, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const PROFILE_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "profiles");
export const PROFILE_PUBLIC_PREFIX = "/uploads/profiles";

export function isManagedProfileAvatar(pathname: string | null) {
  return Boolean(pathname?.startsWith(PROFILE_PUBLIC_PREFIX));
}

export function buildProfileAvatarPaths(userId: string, extension: string) {
  const fileName = `${userId}-${randomUUID()}${extension}`;

  return {
    fileName,
    publicPath: `${PROFILE_PUBLIC_PREFIX}/${fileName}`,
    finalPath: path.join(PROFILE_UPLOAD_DIR, fileName),
    stagedPath: path.join(PROFILE_UPLOAD_DIR, `.staged-${fileName}`),
  };
}

export async function stageProfileAvatar(buffer: Buffer, stagedPath: string) {
  await mkdir(PROFILE_UPLOAD_DIR, { recursive: true });
  await writeFile(stagedPath, buffer);
}

export async function commitProfileAvatar(stagedPath: string, finalPath: string) {
  await rename(stagedPath, finalPath);
}

export async function discardProfileAvatar(paths: { stagedPath: string; finalPath: string }) {
  await unlink(paths.stagedPath).catch(() => undefined);
  await unlink(paths.finalPath).catch(() => undefined);
}

export async function deleteManagedProfileAvatar(publicPath: string | null) {
  if (!publicPath || !isManagedProfileAvatar(publicPath)) {
    return;
  }

  const filePath = path.join(process.cwd(), "public", publicPath);
  await unlink(filePath).catch(() => undefined);
}

export function hasAllowedImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}
