import archiver from "archiver";
import path from "path";
import fs from "fs";

/**
 * zip file
 *   sourceFile，待压缩的文件
 *   destZip，压缩后的zip文件
 *   cb，callback
 */

export function zipFile(sourceFile: string) {
  return new Promise<string>((resolve, reject) => {
    const file_name = sourceFile + ".zip";
    // init
    const output = fs.createWriteStream(file_name);
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    // on
    output.on("close", function () {
      resolve(file_name);
    });
    archive.on("error", function (err) {
      reject(err);
    });

    // zip
    archive.pipe(output);
    archive.file(sourceFile, {
      name: path.basename(sourceFile),
    });
    archive.finalize();
  });
}
