# branch-tone
Project for automatically updating custom branches on github and keep them up do date with base branch.
## Installation
    git clone https://github.com/imatveev/branch-tone.git
## When should I use branch-tone?
You need to keep up to date your custom branches with base branch on github.
## Configuring
You need to specify four parameters in config.js file:
* gitUrl - url of your github instance API (default - 'https://github.com/api/v3')
* APIToken - API token from github instance (if not set - branch-tone wil prompt for credentials)
* branchPattern - Regex pattern for custom branches names that needs to be updated
* baseBranch - name of the base branch
## Using
    npm i
    npm start
