import { route } from "@/lib/route";
import { readScannerApk, scannerAppFileName, scannerAppInfo } from "@/lib/scanner-app";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return route(async () => {
    const [file, info] = await Promise.all([readScannerApk(), scannerAppInfo(request)]);

    return new Response(new Uint8Array(file), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${scannerAppFileName}"`,
        "Content-Length": String(file.byteLength),
        "Content-Type": "application/vnd.android.package-archive",
        "X-Scanner-App-Sha256": info.sha256,
        "X-Scanner-App-Version": info.version,
        "X-Scanner-App-Version-Code": String(info.versionCode),
      },
    });
  });
}
