'use strict';

const fetch    = require('node-fetch');
const Promise  = require('bluebird');
fetch.Promise  = Promise;
const readline = require('readline');
const config   = require('./config');

let login;
let headers        = {};
let updated        = 0;
let errorsCount    = 0;
let barnchesCount  = 0;
let reposCount     = 0;

const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout
});

const question = question => {
    return new Promise(resolve => {
        rl.question(question, answer => resolve(answer));
    });
};

const hidden = (query) => {
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
    return fetch(`${config.gitUrl}/user/repos`, { headers });
})
.then(res => res.json())
.then(data => {
    if (!Array.isArray(data)) {
        process.stderr.write(`\n${data.message}\n`);
        process.exit(1);
    }
    reposCount = data.length;
    return data;
})
.map(repo => {
    return fetch(`${config.gitUrl}/repos/${repo.owner.login}/${repo.name}/branches`, { headers })
    .then(res => res.json())
    .then(branches => ({ branches, owner: repo.owner.login, name: repo.name }));
})
.map(repo => {
    let baseBranch = repo.branches.find(branch => branch.name === 'development');
    return Promise.all(
        repo.branches
        .filter(branch => config.branchPattern.test(branch.name))
        .map(branch => {
            ++barnchesCount;
            return fetch(
                `${config.gitUrl}/repos/${repo.owner}/${repo.name}/merges`,
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
                    ++updated;
                    return;
                }
                if (data.message) {
                    ++errorsCount;
                    process.stderr.write(`${data.message} in ${repo.name} repo: ${branch.name} branch.\n`);
                    return;
                }
            });
        })
    );
})
.then(() => {
    process.stdout.write(`\nUpdated ${updated} branches. Errors in ${errorsCount} branches.\n`);
    process.stdout.write(`\nTotally checked ${barnchesCount} branches in ${reposCount} repos.\n`);
    rl.close();
});
