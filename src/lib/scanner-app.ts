import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import packageJson from "../../package.json";

export const scannerAppFileName = "kiju-lager-scanner.apk";
export const scannerAppPublicPath = `/downloads/${scannerAppFileName}`;
export const scannerAppDownloadPath = "/api/scanner-app/download";
export const scannerAppPackageName = "de.kiju.lager";
export const scannerAppNativeVersion = "1.0.1";
export const scannerAppNativeVersionCode = 2;

function scannerApkPath() {
  return path.join(process.cwd(), "public", "downloads", scannerAppFileName);
}

function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

export function scannerAppBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || requestOrigin(request);
}

export function scannerAppDownloadUrl(request: Request) {
  return new URL(scannerAppDownloadPath, scannerAppBaseUrl(request)).toString();
}

export async function readScannerApk() {
  return readFile(scannerApkPath());
}

export async function scannerAppInfo(request: Request) {
  const file = await readScannerApk();
  const fileStat = await stat(scannerApkPath());

  return {
    name: "KiJu Lager Scanner",
    packageName: scannerAppPackageName,
    version: scannerAppNativeVersion,
    versionCode: scannerAppNativeVersionCode,
    webVersion: packageJson.version,
    fileName: scannerAppFileName,
    sizeBytes: fileStat.size,
    sha256: createHash("sha256").update(file).digest("hex"),
    updatedAt: fileStat.mtime.toISOString(),
    downloadUrl: scannerAppDownloadUrl(request),
    targetUrl: scannerAppBaseUrl(request),
  };
}
