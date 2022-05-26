import * as core from "@actions/core";
import { getInputs } from "./inputs-helper";
import { findFilesToUpload } from "./search";
import { NoFileOptions } from "./constants";
import { create, UploadOptions } from "@actions/artifact";
import { basename, dirname } from "path";
import { setFailed } from "@actions/core";
import { GitHub } from "@actions/github";
import { uploadReleaseFile } from "./releaser";
import { zipFile } from './compress'
async function main(): Promise<void> {
  try {
    const inputs = getInputs();

    /* Find files to upload */
    const filesToUpload = Array<string>();
    const pathLines = inputs.searchPath.split("\n").map((line) => line.trim());
    for (const pathLine of pathLines) {
      const paths = await findFilesToUpload(pathLine);
      if (paths.length !== 0) {
        paths.forEach(async (path) => {
          if (filesToUpload.indexOf(path) < 0) {
            const zip_file = await zipFile(path);
            filesToUpload.push(zip_file);
          }
        });
      } else {
        switch (inputs.ifNoFilesFound) {
          case NoFileOptions.warn: {
            core.warning(
              `No files were found with the provided path: ${pathLine}.`
            );
            break;
          }
          case NoFileOptions.error: {
            core.setFailed(
              `No files were found with the provided path: ${pathLine}.`
            );
            return;
          }
          case NoFileOptions.ignore: {
            break;
          }
        }
      }
    }

    const s = filesToUpload.length === 1 ? "" : "s";
    core.info(
      `With the provided path, there will be ${filesToUpload.length} file${s} uploaded`
    );

    /* Upload artifacts */
    const artifactClient = create();
    const options: UploadOptions = {
      continueOnError: false,
      retentionDays: inputs.retentionDays,
    };
    for (const file of filesToUpload) {
      const rootDirectory = dirname(file);
      const artifactName = basename(file);
      core.info(`⬆️ Uploading artifact ${artifactName}...`);
      await artifactClient.uploadArtifact(
        artifactName,
        Array(file),
        rootDirectory,
        options
      );
    }

    /* Upload release files */
    if (inputs.uploadReleaseFiles) {
      const gh = new GitHub(inputs.githubToken!, {});
      for (const path of filesToUpload) {
        core.info(`⬆️ Uploading release file ${basename(path)}...`);
        await uploadReleaseFile(gh, inputs.releaseUploadUrl!, path);
      }
    }
  } catch (error) {
    setFailed((error as any).message);
  }
}

main();
