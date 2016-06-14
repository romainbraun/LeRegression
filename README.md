# LeRegression
A protractor automated visual regression tool

## Installation

LeRegression requires [Node.js](https://nodejs.org/) v4+ to run.

> `npm install --save-dev le-regression`

## Usage
> `./LeRegression.js [options]`

Options:

    -h, --help                                   output usage information
    -c, --config-file [config-file]              Configuration JSON
    -a, --access-key-id [access-key-id]          S3 Access Key
    -s, --secret-access-key [secret-access-key]  S3 Secret Access Key. These should be set as environment variables in your CI environment
    -h, --commit-hash [commit-hash]              Hash of the current commit (if run from your CI environment)
    -t, --github-token [github-token]            GitHub access token
    -r, --reset-reference                        The script will only create reference files (useful to create references on the master branch)

## Configuration

__Example configuration file:__ (all paths are relative to the working directory, where the script is run from)

```JSON
{
  "sitemap": "./path/to/sitemap.json",
  "capabilities": [
    "./path/to/protractor-configuration-file.js"
  ],
  "threshold": 8000,
  "repository": "romainbraun/LeRegression",
  "s3config": {
    "client" : {
      "multipartUploadSize": 5242880,
      "region": "region of your bucket"
    },
    "bucket": {
      "name": "name of your s3 bucket"
    }
  }
}
```

- `threshold` is the minimum threshold of Absolute Error count (http://www.imagemagick.org/script/command-line-options.php#metric) to consider the screenshot to be different than its reference.

- `capabilities`: You can find example protractor configuration files in `/test/config/`

>*About protractor configuration files: If you decide to use browserstack it is recommended to specify the os and the browser name/version in your protractor configuration file to avoid having screenshot disparities as browserstack otherwise selects browsers randomly and resolutions can be slightly different.*

__Example sitemap:__
```JSON
{
  "Home": {
    "url": "/",
    "wait": 3000
  }
}
```
- `wait` is optional and can be used if your page has a loading animation. The script waits for Angular to be ready and all timeouts/requests to be over but it can't track animations. You can add a delay as a safety net to make sure every animation is over before screenshotting (in milliseconds)


## Suggestion of usage

When using LeRegression in a CI environment it is recommended to call the script with `-r` every time something gets merged to the master branch (to create references) and otherwise call the script normally when any Pull Request is made to master

**Example circle.yml configuration file**
```YAML
test:
  override:
    - |
      if [[ $CIRCLE_BRANCH == qa/* ]] ; then
        PROTRACTOR_BIN=node_modules/protractor/bin/protractor node_modules/le-regression/LeRegression.js -c ./tests/e2e/regression/config.json -a $S3_ACCESS_KEY_ID -s $S3_ACCESS_KEY_SECRET -t $GITHUB_TOKEN -h $CIRCLE_SHA1
      fi
    - |
      if [[ $CIRCLE_BRANCH == master ]] ; then
        PROTRACTOR_BIN=node_modules/protractor/bin/protractor node_modules/le-regression/LeRegression.js -c ./tests/e2e/regression/config.json -a $S3_ACCESS_KEY_ID -s $S3_ACCESS_KEY_SECRET -r
      fi
```