# s3-upload

> Simple Amazon S3 upload CLI tool.

## Prerequisites

- Node
- AWS S3 Credentials (TODO: Link to AWS CLI/env var setup)

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

### Upload

```console
$ s3-upload manifest.yaml
```

If you want to use a different AWS Profile that is configured in `~/.aws/`, then
simply pass the name of the profile along using environment variables:

```console
$ AWS_PROFILE=my-profile s3-upload manifest.yaml
```

### Environment variables

Environment variables in the yaml manifest will be replaced.

```yaml
entry:
  manifest:
    - glob:
        ...
      s3:
        Bucket: ${MY_BUCKET}
        ...
```

## Deploying new versions

```console
$ np
```
