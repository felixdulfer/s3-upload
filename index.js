#! /usr/bin/env node

const { createReadStream, readFileSync } = require("fs");
const { resolve, extname, parse } = require("path");
const { parseAllDocuments } = require("yaml");
const Glob = require("glob");
const Mime = require("mime");
const { Upload } = require("@aws-sdk/lib-storage");
const { S3Client } = require("@aws-sdk/client-s3");
const envsubst = require("@tuplo/envsubst");
const highlight = require("cli-highlight").highlight;
const Handlebars = require("handlebars");

const CWD = process.cwd();
const [, , manifestPathRel] = process.argv;
const manifestPathAbs = resolve(CWD, manifestPathRel || "manifest.yaml");
const manifestRaw = readFileSync(manifestPathAbs, "utf-8");
const manifestRawEnvSubstd = envsubst(manifestRaw);

const DEFAULT_TEMPLATE = "{{root}}/{{prefix}}/{{dir}}/{{name}}{{ext}}";
const STRIP_DOUBLE_SLASHES_REGEXP = /\/\/+/;
const STRIP_LEADING_SLASHES_REGEXP = /^\//;

console.log(`
================================================================================
YAML Manifest
================================================================================
`);
console.log(highlight(manifestRawEnvSubstd, { language: "yaml" }));

const manifestDocuments = parseAllDocuments(manifestRawEnvSubstd, {
  merge: true,
});

const [manifest] = manifestDocuments.map((doc) => doc.toJSON());

const manifestFlat = Object.keys(manifest)
  .filter((key) => key.indexOf(".") !== 0)
  .map((key) => manifest[key])
  .map(({ manifest }) => manifest)
  .flat();

console.log(`
================================================================================
JSON Manifest
================================================================================
`);
console.log(highlight(JSON.stringify(manifestFlat, null, 2)));

console.log(`
================================================================================
Upload
================================================================================
`);

function getFiles({ glob, ...props }) {
  return new Promise((resolve, reject) => {
    Glob(glob.pattern, { ...glob.options }, (e, files) => {
      if (e) return reject(e);
      else return resolve({ files, glob: glob, ...props });
    });
  });
}

function rename({ files, s3, rename, ...props }) {
  return {
    files: files.map((file) => {
      const {
        options: { prefix },
      } = s3;
      const keyParsed = parse(file);
      const keyTemplate = Handlebars.compile(rename ?? DEFAULT_TEMPLATE);
      const keyDirty = keyTemplate({ ...keyParsed, prefix });
      const keyClean = keyDirty
        .replace(STRIP_DOUBLE_SLASHES_REGEXP, "/")
        .replace(STRIP_LEADING_SLASHES_REGEXP, "");
      const returnValue = { file, key: keyClean };
      return returnValue;
    }),
    s3,
    rename,
    ...props,
  };
}

function upload({ files, s3, glob, tags, ...props }) {
  return Promise.all(
    files.map(({ file, key }) => {
      const absFile = resolve(CWD, glob.options.cwd, file);
      const { options, ...params } = s3;

      const target = {
        ...params,
        Key: key,
        Body: createReadStream(absFile),
        ContentType: Mime.getType(extname(file)),
      };

      const parallelUploads3 = new Upload({
        client: new S3Client({
          region:
            options?.client?.region ??
            process.env.AWS_REGION ??
            process.env.AWS_DEFAULT_REGION,
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
    const uploaded = await Promise.all(
      files
        .flat()
        .map((entry) => rename(entry))
        .map((entry) => upload(entry))
    );
    console.dir({ uploaded }, { depth: 3 });
    console.log("All done!");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
