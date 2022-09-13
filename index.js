const core = require("@actions/core");
const fetch = require("cross-fetch");
const {
  RateLimiterMemory,
  RateLimiterQueue,
} = require("rate-limiter-flexible");

// e.g. 1 request per 2 seconds
const limiterFlexible = new RateLimiterMemory({
  points: 1,
  duration: 2,
});

const limiterQueue = new RateLimiterQueue(limiterFlexible, {
  maxQueueSize: 100,
});

const orgName = core.getInput("org_name", {
  required: true,
});
const appName = core.getInput("app_name", {
  required: true,
});
const appVersion = core.getInput("app_version", {
  required: true,
});
const toKeep = core.getInput("to_keep", {
  required: false,
});
const dryRun = core.getBooleanInput("dry_run", {
  required: false,
});
const apiToken = core.getInput("api_key", {
  required: true,
});
const appCenterUrl =
  "https://api.appcenter.ms/v0.1/apps/" + orgName + "/" + appName + "/releases";

console.log("orgName : " + orgName);
console.log("appName : " + appName);
console.log("appVersion : " + appVersion);
console.log("toKeep : " + toKeep);
console.log("dryRun : " + dryRun);
console.log("apiToken : " + apiToken);

const getOptions = {
  method: "GET",
  headers: {
    accept: "application/json",
    "X-API-Token": apiToken,
  },
};

const deleteOptions = {
  method: "DELETE",
  headers: {
    accept: "application/json",
    "X-API-Token": apiToken,
  },
};

/**
 * getReleases
 *
 * Fetch a list of releases and filter based on version number
 *
 * @returns Promise<number> - array of release ids to purge
 */
async function getReleases() {
  const response = await fetch(appCenterUrl, getOptions);
  if (!response.ok) {
    throw new Error(
      `HTTP error! status: ${response.status} - ${response.statusText}`
    );
  }
  const releases = await response.json();

  const releasesToPurge = releases
    .filter((release) => release.short_version === appVersion)
    .map((release) => release.id);

  return releasesToPurge;
}

/**
 * deleteRelease
 *
 * Delete an individual release by id
 *
 * @param {*} releaseId
 * @returns Promise<boolean>
 */
async function deleteRelease(releaseId) {
  const response = await fetch(appCenterUrl + "/" + releaseId, deleteOptions);
  if (!response.ok) {
    throw new Error(
      `HTTP error! status: ${response.status} - ${response.statusText}`
    );
  }

  // console.log(`Response (${releaseId}) : ` + response.text())

  return releaseId;
}

async function main() {
  try {
    const appReleases = await getReleases();

    if (!appReleases.length) {
      core.info(`No releases to purge`);
      return;
    }

    if (appReleases.length < toKeep) {
      core.info(
        `Minimum "toKeep" rows already exist, rows=${appReleases.length}, toKeep=${toKeep}`
      );
      return;
    }

    if (toKeep === 0) {
      core.info(`All rows will be purged!`);
    }

    // Only delete releases after the number to keep
    const releasesToPurge = appReleases.slice(0, -toKeep);

    core.debug(`Release IDs to purge: ${JSON.stringify(releasesToPurge)}`);

    // Run all delete requests in parallel (fast) - but limited by the rate limiter settings
    const deleteResult = await Promise.allSettled(
      releasesToPurge.map(async (releaseId) => {
        await limiterQueue.removeTokens(1);

        if (dryRun) {
          core.debug(`Dry run, not purging releaseId=${releaseId}`);
          return releaseId;
        }
        core.debug(`Purging releaseId=${releaseId}`);
        return deleteRelease(releaseId);
      })
    );

    // Grab the IDs of the releases that succeeded
    const succeededDeletedIds = deleteResult
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    // Grab the IDs that failed by using the original array and filtering out the succeeded items
    const failedDeletedIds = releasesToPurge.filter(
      (releaseId) => !succeededDeletedIds.includes(releaseId)
    );

    if (!dryRun) {
      core.debug(`Delete result: ${JSON.stringify(deleteResult)}`);

      if (succeededDeletedIds.length) {
        core.info(
          `Successfully deleted releases: [${succeededDeletedIds.join(", ")}]`
        );
      }
      if (failedDeletedIds.length) {
        core.info(
          `Failed to delete releases: [${failedDeletedIds.join(", ")}]`
        );
      }
    }

    core.info(`Action complete`);

    if (failedDeletedIds.length && !dryRun) {
      core.setFailed(`Failed to delete ${failedDeletedIds.length} releases`);
    }
  } catch (e) {
    core.setFailed(e.message);
  }
}

main();
