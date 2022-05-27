import * as core from "@actions/core";
import { getInputs } from "./inputs-helper";
import { findFilesToUpload } from "./search";
import { NoFileOptions } from "./constants";
import { create, UploadOptions } from "@actions/artifact";
import { basename, dirname } from "path";
import { getOctokit, context } from "@actions/github";
import { zipFile } from "./compress";
import { readFileSync } from "fs";

async function main(): Promise<void> {
  const inputs = getInputs();
  const gh = getOctokit(inputs.githubToken!, {});
  const artifactClient = create();
  const { owner, repo } = context.repo;

  /* Find files to upload */
  const filesToUpload = Array<Promise<string>>();
  const pathLines = inputs.searchPath.split("\n").map((line) => line.trim());
  for (const pathLine of pathLines) {
    const paths = await findFilesToUpload(pathLine);
    if (paths.length !== 0) {
      paths.forEach((path) => {
        filesToUpload.push(zipFile(path));
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
  const options: UploadOptions = {
    continueOnError: false,
    retentionDays: inputs.retentionDays,
  };
  for (const filePromise of filesToUpload) {
    const file = await filePromise;
    const rootDirectory = dirname(file);
    const artifactName = basename(file);
    core.info(`⬆️ Uploading artifact ${artifactName}...`);
    await artifactClient.uploadArtifact(
      artifactName,
      Array(file),
      rootDirectory,
      options
    );

    /* Upload release files */
    if (inputs.uploadReleaseFiles) {
      core.info(`⬆️ Uploading release file ${basename(file)}...` + context.ref);
      await gh.rest.repos.uploadReleaseAsset({
        name: basename(file),
        data: readFileSync(file, 'utf8'),
        owner,
        repo,
        release_id: Number.parseFloat(context.ref),
      });
    }
  }
}

main();
