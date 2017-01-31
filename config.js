'use strict';

module.exports = {
    gitUrl:        'https://api.github.com',
    APIToken:      '',
    branchPattern: /Custom-branch-name-pattern/,
    baseBranch:    'develoment',
    notifier: {
        service: 'gmail',
        user:    'noreply@gmail.com',
        pass:    '',
        from:    '"Name" <email>',
        to:      [ 'someone@gmail.com' ],
        subject: 'Report subject'
    }
};
