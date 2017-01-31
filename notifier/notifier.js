'use strict';

const nodemailer = require('nodemailer');

module.exports = class Notifier {
    constructor(service='gmail', user, pass, from) {
        this.transporter = nodemailer.createTransport({
            service: service,
            auth:    { user, pass }
        });
        this.from = from;
    }

    notify(to, subject, html) {
        let mailOptions = {
            from: this.from,
            to: to.join(', '),
            subject,
            html
        };
        return new Promise((resolve, reject) => {
            this.transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    return reject(error);
                }
                return resolve(info);
            });
        });
    }
};
