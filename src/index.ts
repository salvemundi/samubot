import { Application } from 'probot'
const atob = require('atob')
const btoa = require('btoa')

const pullRequestType = {
  major: 1,
  minor: 2,
  patch: 3,
  unknown: 0
}

export = (app: Application) => {
  app.on('pull_request.opened', async (context) => {
    const body: string = context.payload.pull_request.body
    let typeRequest
    if (body.includes('[x] Major')) {
      typeRequest = pullRequestType.major
    } else if (body.includes('[x] Minor')) {
      typeRequest = pullRequestType.minor
    } else if (body.includes('[x] Patch')) {
      typeRequest = pullRequestType.patch
    } else {
      typeRequest = pullRequestType.unknown
    }

    if (typeRequest === pullRequestType.unknown) {
      await context.github.issues.createComment({
        body: 'Unknown pull request type, please define a type using the template...',
        number: context.payload.number,
        owner: context.payload.pull_request.head.repo.owner.login,
        repo: context.payload.pull_request.head.repo.name
      })
      return
    }

    // Get sha of last commit
    const packageJsonSha = (await context.github.repos.getContents({
      owner: context.payload.pull_request.head.repo.owner.login,
      repo: context.payload.pull_request.head.repo.name,
      path: 'package.json',
      ref: context.payload.pull_request.head.ref
    })).data.sha

    // Get package.json from develop branch
    const packageJsonPayload = await context.github.repos.getContents({
      owner: context.payload.pull_request.head.repo.owner.login,
      repo: context.payload.pull_request.head.repo.name,
      path: 'package.json',
      ref: 'develop'
    })

    // Increment version number
    const packageJson = JSON.parse(atob(packageJsonPayload.data.content))
    const versionArray: string[] = packageJson.version.split('.')
    if (typeRequest === pullRequestType.major) {
      versionArray[0] = String(parseInt(versionArray[0]) + 1)
      versionArray[1] = String(0)
      versionArray[2] = String(0)
    } else if (typeRequest === pullRequestType.minor) {
      versionArray[1] = String(parseInt(versionArray[1]) + 1)
      versionArray[2] = String(0)
    } else if (typeRequest === pullRequestType.patch) {
      versionArray[2] = String(parseInt(versionArray[2]) + 1)
    }
    packageJson.version = versionArray.join('.')

    // Push new package.json
    await context.github.repos.updateFile({
      message: 'Updated version number',
      owner: context.payload.pull_request.head.repo.owner.login,
      repo: context.payload.pull_request.head.repo.name,
      path: 'package.json',
      sha: packageJsonSha,
      content: btoa(JSON.stringify(packageJson)),
      branch: context.payload.pull_request.head.ref
    })
  })
}
