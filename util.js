'use strict';

const fs = require('fs');

module.exports = {
    readFile(path) {
        return new Promise((resolve, reject) => {
            fs.readFile(path, 'utf-8', (error, data) => {
                if (error) {
                    return reject(error);
                }
                return resolve(data);
            });
        });
    }
};
