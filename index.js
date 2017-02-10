'use strict';

const fetch        = require('node-fetch');
const Promise      = require('bluebird');
fetch.Promise      = Promise;
const readline     = require('readline');
const config       = require('./config');
const handlebars   = require('handlebars');
const Notifier     = require('./notifier/notifier');
const { readFile } = require('./util');

let notifierConfig = config.notifier;
let notifier = new Notifier(
    notifierConfig.service,
    notifierConfig.user,
    notifierConfig.pass,
    notifierConfig.from
);

let gitUrl = config.gitUrl || 'https://github.com/api/v3';

let login;
let headers    = { Accept: 'application/vnd.github.loki-preview+json' };
let reportData = {};

const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout
});

const question = question => {
    return new Promise(resolve => {
        rl.question(question, answer => resolve(answer));
    });
};

const hidden = query => {
    return new Promise(resolve => {
        let stdin = process.openStdin();
        process.stdin.on("data", char => {
            char = `${char}`;
            let breaking = ['\n', '\r', '\u0004'];
            if (breaking.indexOf(char) !== -1) {
                stdin.pause();
                return;
            }
            readline.clearLine(stdin, 0);
            readline.moveCursor(stdin, -100, 0);
            process.stdout.write(query + Array(rl.line.length+1).join("*"));
        });

        rl.question(query, value => {
            rl.history = rl.history.slice(1);
            resolve(value);
        });
    });
};

Promise.resolve()
.then(() => {
    if (!config.APIToken) {
        return question('Username: ')
        .then(username => {
            login = username;
            return hidden('Password: ');
        })
        .then(password => {
            return `Basic ${new Buffer(login+':'+password).toString('base64')}`;
        });
    }
    return `token ${config.APIToken}`;
})
.then(auth => {
    headers.Authorization = auth;
    return fetch(`${gitUrl}/user/repos`, { headers });
})
.then(res => res.json())
.then(data => {
    if (!Array.isArray(data)) {
        process.stderr.write(`\n${data.message}\n`);
        process.exit(1);
    }
    return data;
})
.map(repo => {
    return fetch(`${gitUrl}/repos/${repo.owner.login}/${repo.name}/branches`, { headers })
    .then(res => res.json())
    .then(branches => ({ branches, owner: repo.owner.login, name: repo.name }));
})
.then(repos => {
    reportData = {};
    reportData.repos = repos;
    reportData.reposCount = repos.length;
    reportData.totallyUpdated = 0;
    reportData.withErrors = 0;
    reportData.branchesCount = 0;
    return repos;
})
.map(repo => {
    return fetch(`${gitUrl}/repos/${repo.owner}/${repo.name}/commits?since=${new Date(Date.now()-7200000).toISOString()}`, { headers })
    .then(res => res.json())
    .then(commits => {
        if (Array.isArray(commits) && commits.length) {
            reportData.repos.find(curRepo => curRepo.name === repo.name).commits = commits;
        }
        return repo;
    });
})
.map(repo => {
    let baseBranch = repo.branches.find(branch => branch.name === config.baseBranch);
    if (!baseBranch) {
        return;
    }
    return Promise.all(
        repo.branches
        .filter(branch => config.branchPattern.test(branch.name))
        .map(branch => {
            ++reportData.branchesCount;
            return fetch(
                `${gitUrl}/repos/${repo.owner}/${repo.name}/merges`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        base:           branch.name,
                        head:           baseBranch.name,
                        commit_message: `Merge branch ${baseBranch.name} into ${branch.name} (automatic update)`
                    }),
                    headers
                }
            )
            .then(res => res.json())
            .then(data => {
                if (data.sha) {
                    reportData.repos = reportData.repos.map(curRepo => {
                        if (curRepo.name === repo.name) {
                            curRepo.updatedBranches = curRepo.updatedBranches || [];
                            curRepo.updatedBranches.push(branch.name);
                            curRepo.toRender = true;
                        }
                        return curRepo;
                    });
                    ++reportData.totallyUpdated;
                    return;
                }
                if (data.message) {
                    reportData.repos = reportData.repos.map(curRepo => {
                        if (curRepo.name === repo.name) {
                            curRepo.rejectedBranches = curRepo.rejectedBranches || [];
                            curRepo.rejectedBranches.push({ name: branch.name, reason: data.message });
                            curRepo.toRender = true;
                        }
                        return curRepo;
                    });
                    ++reportData.withErrors;
                    process.stderr.write(`${data.message} in ${repo.name} repo: ${branch.name} branch.\n`);
                    return;
                }
            });
        })
    );
})
.then(() => {
    process.stdout.write(`\nUpdated ${reportData.totallyUpdated} branches. Errors in ${reportData.withErrors} branches.\n`);
    process.stdout.write(`\nTotally checked ${reportData.branchesCount} branches in ${reportData.reposCount} repos.\n`);
    rl.close();
    return readFile('./templates/report.html');
})
.then(html => {
    let template = handlebars.compile(html);
    let rendered = template(reportData);
    if (reportData.repos.some(repo => repo.toRender) && notifierConfig.to && notifierConfig.to.length) {
        return notifier.notify(notifierConfig.to, notifierConfig.subject, rendered);
    }
});
