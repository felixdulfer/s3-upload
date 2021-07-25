# s3-upload

> Simple Amazon S3 upload CLI tool.

## Prerequisites

* Node
* AWS S3 Credentials (TODO: Link to AWS CLI/env var setup)

## Usage

### Create a YAML manifest

**Example `manifest.yaml`:**

```yaml
entry:
  manifest:
    - glob:
        pattern: "*.html"
        options:
          cwd: dist
      s3:
        Bucket: my-bucket
        ACL: public-read
        CacheControl: "public, max-age: 60"
        StorageClass: REDUCED_REDUNDANCY
```

Any yaml is OK, as long as [yaml](https://www.npmjs.com/package/yaml) supports
it. This includes the use of anchors.

### TODO: upload

```console
$ s3-upload manifest.yaml
```

### TODO: environment variables

```yaml
entry:
  manifest:
    - glob:
        ...
      s3:
        Bucket: ${MY_BUCKET}
        ...
```
