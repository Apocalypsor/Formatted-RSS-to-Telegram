const axios = require('axios');
const {config} = require('./config');

const client = axios.create({
    timeout: 10000,
    headers: {
        'User-Agent': config.userAgent,
    },
});

module.exports = client;