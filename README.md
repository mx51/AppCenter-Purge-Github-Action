# AppCenter-Purge-Github-Action

A GitHub Action that can purge App Center of old uploads.

This script uses the API documented here [https://openapi.appcenter.ms/](https://openapi.appcenter.ms/)

## Inputs
1. **org_name** : Organisation name e.g. myOrg.
1. **app_name** : Application name within the specified organisation e.g SUPER-COOL-APP.
1. **app_version** : The version name of the app, as listed on the App Center website e.g 1.0.0.
1. **to_keep** : the number of versions of the specified app version to keep (default = 1)
1. **dry_run** : True if you want to test the script, false if you want to actually perform the deletions (default true)  
1. **api_key** : An App Center API key with read/write access to the specified organisation.

## App Center
For an application that lives at the specified URL  

https://appcenter.ms/orgs/myOrg/apps/SUPER-COOL-APP/distribute/releases

You can purge old builds of each release with the example code below.

## Example usage

app_versions.gradle.kts
```
extra.set("app_version_name", "1.0.0")
```

.github/workflows/purge_old_builds.yml
```
name: Purge old builds
on:
  push:
    branches: [ main ]

jobs:
  purge-old-builds:
    name: Purge old builds
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Setup release information
        #get version name from app_versions.gradle.kts file (e.g 1.0.0)
        run: |
          versionName=`sed '1q;d' app_versions.gradle.kts | cut -d "," -f2 | xargs | tr ')' ' '`
          echo "VERSION_NAME=$versionName" >> $GITHUB_ENV
      - name: App Center Purge
        uses: mx51/AppCenter-Purge-Github-Action@v1.0
        with:
          org_name: "myOrg"
          app_name: "SUPER-COOL-APP"
          app_version: ${{ env.VERSION_NAME }}
          to_keep: 1
          dry_run: false
          api_key: ${{secrets.APP_CENTER_TOKEN}}

```          