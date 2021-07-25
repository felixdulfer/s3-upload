#! /usr/bin/env node

const { createReadStream, readFileSync } = require("fs");
const { resolve, extname } = require("path");
const { parseAllDocuments } = require("yaml");
const Glob = require("glob");
const Mime = require("mime");
const { Upload } = require("@aws-sdk/lib-storage");
const { S3Client } = require("@aws-sdk/client-s3");
const envsubst = require("@tuplo/envsubst");
const highlight = require("cli-highlight").highlight;

const CWD = process.cwd();
const [, , manifestPathRel] = process.argv;
const manifestPathAbs = resolve(CWD, manifestPathRel || "manifest.yaml");
const manifestRaw = readFileSync(manifestPathAbs, "utf-8");
const manifestRawEnvSubstd = envsubst(manifestRaw);

console.log(highlight(manifestRawEnvSubstd, { language: "yaml" }));

const manifestDocuments = parseAllDocuments(manifestRawEnvSubstd);
const [manifest] = manifestDocuments.map((doc) => doc.toJSON());
const manifestFlat = Object.keys(manifest)
  .filter((key) => key.indexOf(".") !== 0)
  .map((key) => manifest[key])
  .map(({ manifest }) => manifest)
  .flat();

function getFiles({ glob, ...props }) {
  return new Promise((resolve, reject) => {
    Glob(glob.pattern, { ...glob.options }, (e, files) => {
      if (e) return reject(e);
      else return resolve({ files, glob: glob, ...props });
    });
  });
}

function upload({ files, s3, glob, tags, ...props }) {
  return Promise.all(
    files.map((file) => {
      const absFile = resolve(CWD, glob.options.cwd, file);

      const target = {
        ...s3,
        Key: file,
        Body: createReadStream(absFile),
        ContentType: Mime.getType(extname(file)),
      };

      const parallelUploads3 = new Upload({
        client: new S3Client({
          region: process.env.AWS_DEFAULT_REGION || "eu-central-1",
        }),
        tags: [...tags],
        queueSize: 4,
        partSize: "5MB",
        leavePartsOnError: false,
        params: { ...target },
      });

      console.log(`Uploading ${target.Key}...`);

      return parallelUploads3.done().then((res) => {
        console.log(`Done: ${target.Key} ==>> ${res.Location}`);
        return res;
      });
    })
  );
}

void (async function main() {
  try {
    const files = await Promise.all(
      manifestFlat.map((entry) => getFiles(entry))
    );
    console.dir(files, { depth: 3 });
    const uploaded = await Promise.all(
      files.flat().map((entry) => upload(entry))
    );
    console.dir({ uploaded }, { depth: 3 });
    console.log("All done!");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
